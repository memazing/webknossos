#!/bin/bash
# webknossos-vm startup script. Runs as root on every boot; idempotent.
# Progress goes to the serial console, which is readable without the IAP
# tunnel:  gcloud compute instances get-serial-port-output webknossos-vm
set -uo pipefail
say() { echo "WKSETUP: $*"; }
say "begin $(date -u +%FT%TZ)"

WK_TAG=26.09.1
DIR=/opt/webknossos

# Run our own build instead of upstream's published release. Off, and it must
# stay off until cloudbuild.yaml can actually produce an image: the Dockerfile
# it uses only packages a pre-built tree (COPY target/universal/stage), and the
# yarn + sbt compile phase that produces that tree is missing, so no image has
# ever been published. The fork also carries no source changes yet -- only
# deploy config -- so self-building would currently rebuild upstream's code
# with extra risk and no benefit. Flip to 1 once the build works AND the fork
# actually diverges.
USE_OWN_IMAGE=0

# Public hostname. Changing it here is enough: it is reconciled into .env on
# every run (see below), unlike the secrets, which stay write-once.
WK_PUBLIC_HOST=webknossos.memazingcloud.com

# Sign in with Google (OIDC) instead of WEBKNOSSOS's own accounts. IAP already
# restricts who can reach the host; this is what gives the app an identity so
# users are not asked to log in a second time. The client secret is NOT here:
# instance metadata is readable by every project Editor. It lives in
# /opt/webknossos/.env as OIDC_CLIENT_SECRET, added by hand.
ENABLE_OIDC=1
OIDC_CLIENT_ID=895796082390-kckkamb44km3qqikpa97u73dsvs79mp2.apps.googleusercontent.com

# ---------------------------------------------------------------- docker ---
# Debian 12 ships neither docker-compose-plugin nor docker-compose-v2, so the
# compose v2 plugin has to come from Docker's own repository. Errors are
# logged, not swallowed: the first attempt failed silently in three seconds.
if ! docker compose version >/dev/null 2>&1; then
  say "installing docker + compose plugin from download.docker.com"
  export DEBIAN_FRONTEND=noninteractive
  for i in $(seq 1 10); do
    curl -fsS -m 20 -o /dev/null https://download.docker.com/linux/debian/gpg && break
    say "waiting for egress (attempt $i)"; sleep 10
  done
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    || { say "FAIL fetch docker gpg key"; exit 1; }
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq 2>&1 | tail -5 | sed 's/^/WKSETUP: apt-update /'
  if ! apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>&1 | tail -15 | sed 's/^/WKSETUP: apt-install /'; then
    say "FAIL docker install (see apt-install lines above)"
    exit 1
  fi
  systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 || { say "FAIL no compose plugin"; exit 1; }
say "docker ready: $(docker --version)"

# ------------------------------------------------------------- registry ---
# Pull our own image. Needs roles/artifactregistry.reader on
# webknossos-vm@ (repo-scoped is enough); the VM's cloud-platform scope
# supplies the token via the credential helper.
if [ "$USE_OWN_IMAGE" = "1" ]; then
  gcloud auth configure-docker us-east1-docker.pkg.dev --quiet 2>&1 | tail -2
fi

# ------------------------------------------------------------- compose set --
mkdir -p "$DIR"/persistent/{postgres,fossildb/data,fossildb/backup} "$DIR"/binaryData
cd "$DIR"

if [ ! -f docker-compose.yml ]; then
  say "fetching compose $WK_TAG"
  curl -fsSL -o docker-compose.yml \
    "https://raw.githubusercontent.com/scalableminds/webknossos/${WK_TAG}/tools/hosting/docker-compose.yml" \
    || { say "FAIL fetch compose"; exit 1; }
fi

# Secrets live on this disk only. The VM has no public IP and Postgres and
# FossilDB sit on the same disk, so the disk is already the trust boundary.
# M1 moves these to Secret Manager.
if [ ! -f .env ]; then
  say "generating secrets"
  cat > .env <<EOF
DOCKER_TAG=${WK_TAG}
PUBLIC_HOST=${WK_PUBLIC_HOST}
PUBLIC_URL=https://${WK_PUBLIC_HOST}
LETSENCRYPT_EMAIL=unused@memazing.com
USER_UID=0
USER_GID=0
POSTGRES_PASSWORD=$(openssl rand -hex 24)
PLAY_SECRET=$(openssl rand -hex 32)
DATASTORE_KEY=$(openssl rand -hex 24)
TRACINGSTORE_KEY=$(openssl rand -hex 24)
EOF
  chmod 600 .env
fi

# .env is generated only when absent, so the credentials in it survive. That
# guard also froze the hostname: editing it in this script changed nothing on
# a VM that already had the file, the run still reported READY, and the app
# kept publishing links to the old name. Non-secret keys are therefore
# reconciled on every run; secrets are not touched.
sed -i "s|^PUBLIC_HOST=.*|PUBLIC_HOST=${WK_PUBLIC_HOST}|; s|^PUBLIC_URL=.*|PUBLIC_URL=https://${WK_PUBLIC_HOST}|" .env
# shellcheck disable=SC1091
set -a; . ./.env; set +a

if [ "$ENABLE_OIDC" = "1" ] && [ -z "${OIDC_CLIENT_SECRET:-}" ]; then
  say "FAIL ENABLE_OIDC=1 but OIDC_CLIENT_SECRET is missing from .env."
  say "     Add it there by hand, then re-run. Not settable via metadata."
  exit 1
fi

# Override, not a patched copy, so the upstream file stays pristine and a
# version bump is a one-line change to WK_TAG.
#  - bind 0.0.0.0 so the IAP tunnel can reach 9000 (upstream binds loopback,
#    which a tunnel cannot reach); the firewall admits only IAP's range
#  - http.uri stays internal: WEBKNOSSOS's own components call each other
#    through it, and pointing it at a proxy is what breaks IAP deployments
#  - publicUri is localhost for M0 (tunnel); M1 changes it to the LB domain
#  - explicit heap: the image sets none
cat > docker-compose.override.yml <<'EOF'
services:
  webknossos:
    # Explicit on purpose: this service previously had no image override and
    # silently inherited upstream's from docker-compose.yml. Swapped to our
    # Artifact Registry build when USE_OWN_IMAGE=1 (see the top of this file).
    image: scalableminds/webknossos:${DOCKER_TAG}
    ports: !override
      - "0.0.0.0:9000:9000"
    command:
      - -J-Xmx16G
      - -J-Xms1G
      - -Dconfig.file=conf/application.conf
      - -Djava.net.preferIPv4Stack=true
      - -Dtracingstore.fossildb.address=fossildb
      - -Dtracingstore.redis.address=redis
      - -Ddatastore.redis.address=redis
      - -Dslick.db.url=jdbc:postgresql://postgres/webknossos?user=postgres&password=${POSTGRES_PASSWORD}
      - -DwebKnossos.sampleOrganization.enabled=false
      - -Dhttp.uri=http://localhost:9000
      - -Ddatastore.publicUri=${PUBLIC_URL}
      - -Dtracingstore.publicUri=${PUBLIC_URL}
      - -Dplay.http.secret.key=${PLAY_SECRET}
      - -Ddatastore.key=${DATASTORE_KEY}
      - -Dtracingstore.key=${TRACINGSTORE_KEY}
    environment:
      - POSTGRES_URL=jdbc:postgresql://postgres/webknossos?user=postgres&password=${POSTGRES_PASSWORD}
  postgres:
    environment:
      POSTGRES_DB: webknossos
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  apply-evolutions:
    image: scalableminds/webknossos:${DOCKER_TAG}
    environment:
      - POSTGRES_URL=jdbc:postgresql://postgres/webknossos?user=postgres&password=${POSTGRES_PASSWORD}
      - PGPASSWORD=${POSTGRES_PASSWORD}
EOF

if [ "$USE_OWN_IMAGE" = "1" ]; then
  sed -i "s|image: scalableminds/webknossos:\${DOCKER_TAG}|image: us-east1-docker.pkg.dev/the-pulsar-481518-f3/cloud-run-source-deploy/webknossos:latest|g" docker-compose.override.yml
  say "using our own image: us-east1-docker.pkg.dev/the-pulsar-481518-f3/cloud-run-source-deploy/webknossos:latest"
fi

if [ "$ENABLE_OIDC" = "1" ]; then
  # ${OIDC_CLIENT_SECRET} stays literal here so compose resolves it from .env
  # at container-create time, exactly like the other secrets in this stack.
  #
  # registerToDefaultOrgaEnabled=false removes the self-registration link, so
  # no new local accounts can be created and Google is the only way in. Note
  # it does NOT hide the email/password form itself: in 26.09.1 that form is
  # rendered unconditionally in login_form.tsx and no config flag gates it.
  # Existing local accounts, if any, keep working.
  sed -i "/-Dtracingstore.key=/a\\
      - -DsingleSignOn.openIdConnect.providerUrl=https://accounts.google.com\\
      - -DsingleSignOn.openIdConnect.clientId=${OIDC_CLIENT_ID}\\
      - -DsingleSignOn.openIdConnect.clientSecret=\${OIDC_CLIENT_SECRET}\\
      - -DsingleSignOn.openIdConnect.scope=openid profile email\\
      - -Dfeatures.openIdConnectEnabled=true\\
      - -Dfeatures.registerToDefaultOrgaEnabled=false" docker-compose.override.yml
  say "OIDC enabled for client ${OIDC_CLIENT_ID}"
fi

# Both blocks above rewrite the generated override, so they must run BEFORE
# the containers are created -- editing it afterwards silently defers the
# change to the next run. Validate the result rather than discovering a
# malformed override as a failed start.
docker compose config -q || { say "FAIL docker-compose.override.yml is invalid"; exit 1; }

# ------------------------------------------------------------------- run ---
say "starting datastores"
docker compose up -d postgres fossildb redis 2>&1 | tail -3
sleep 20
say "applying evolutions"
docker compose run --rm apply-evolutions 2>&1 | tail -5
say "starting webknossos"
docker compose up -d webknossos 2>&1 | tail -3

# ---------------------------------------------------------- auto-update ---
# Pull-based deploy: Cloud Build publishes :latest on a push to master, this
# timer notices the new digest and rolls it out. Nothing is pushed to the VM,
# so no inbound path and no build-side credentials are needed.
if [ "$USE_OWN_IMAGE" = "1" ]; then
cat > /usr/local/bin/webknossos-update <<'UPD'
#!/bin/bash
set -euo pipefail
cd /opt/webknossos
IMG="us-east1-docker.pkg.dev/the-pulsar-481518-f3/cloud-run-source-deploy/webknossos:latest"
before=$(docker image inspect --format '{{.Id}}' "$IMG" 2>/dev/null || echo none)
docker pull -q "$IMG" >/dev/null
after=$(docker image inspect --format '{{.Id}}' "$IMG")
[ "$before" = "$after" ] && exit 0
logger -t webknossos-update "new image $after; redeploying"
docker compose run --rm apply-evolutions
docker compose up -d webknossos
docker image prune -f >/dev/null 2>&1 || true
UPD
chmod +x /usr/local/bin/webknossos-update

cat > /etc/systemd/system/webknossos-update.service <<'SVC'
[Unit]
Description=Roll out a new webknossos image if one has been published
After=docker.service
Requires=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/bin/webknossos-update
SVC

cat > /etc/systemd/system/webknossos-update.timer <<'TMR'
[Unit]
Description=Check for a new webknossos image every 5 minutes
[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
TMR

systemctl daemon-reload
systemctl enable --now webknossos-update.timer
say "auto-update timer enabled"
else
  say "auto-update timer skipped (USE_OWN_IMAGE=0)"
fi

for i in $(seq 1 60); do
  code=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' http://localhost:9000/api/buildinfo 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then
    say "READY buildinfo=200 after ${i}0s"
    curl -sS -m 10 http://localhost:9000/api/features 2>/dev/null | head -c 400 | sed 's/^/WKSETUP: features /'
    echo
    say "done $(date -u +%FT%TZ)"
    exit 0
  fi
  sleep 10
done
say "FAIL webknossos did not answer on 9000; last docker compose ps:"
docker compose ps 2>&1 | sed 's/^/WKSETUP: /'
docker compose logs --tail=30 webknossos 2>&1 | sed 's/^/WKSETUP: /'
exit 1

# --------------------------------------------------------------- verify ---
# !! DEAD CODE — NEVER RUNS. The readiness loop above exits 0 on success and
# !! 1 on failure, so control never reaches this point. The ADC check below
# !! has therefore never executed, and the assumption it was written to test
# !! is still unverified at runtime. Either move this block above the loop or
# !! delete it; leaving it here reads as a test that is running when it isn't.
#
# The load-bearing assumption: the datastore attaches no credential for a
# gs:// dataset and relies on Application Default Credentials, i.e. this
# VM's own service account via the metadata server. Research confirmed that
# in the code but never at runtime. Test it directly.
say "verify: build version"
curl -sS -m 10 http://localhost:9000/api/buildinfo 2>/dev/null | head -c 220 | sed 's/^/WKSETUP: buildinfo /'
echo
TOK=$(curl -sS -m 10 -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' 2>/dev/null \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
if [ -z "$TOK" ]; then say "verify: FAIL no metadata token"; else
  OBJ=$(curl -sS -m 20 -H "Authorization: Bearer $TOK" \
    'https://storage.googleapis.com/storage/v1/b/memazing-volumes/o?prefix=sections/&delimiter=/&maxResults=1' 2>/dev/null)
  echo "$OBJ" | head -c 200 | sed 's/^/WKSETUP: verify-list /'; echo
  KEY=$(curl -sS -m 20 -H "Authorization: Bearer $TOK" \
    'https://storage.googleapis.com/storage/v1/b/memazing-volumes/o?prefix=sections/&maxResults=1&fields=items(name)' 2>/dev/null \
    | sed -n 's/.*"name": *"\([^"]*\)".*/\1/p' | head -1)
  if [ -n "$KEY" ]; then
    CODE=$(curl -sS -m 30 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOK" \
      "https://storage.googleapis.com/memazing-volumes/${KEY}" 2>/dev/null)
    say "verify: ADC read of ${KEY} -> HTTP ${CODE}"
  else
    say "verify: FAIL could not list any object under sections/"
  fi
fi
say "verify done"

