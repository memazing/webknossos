#!/usr/bin/env bash
# Apply deploy/startup.sh to webknossos-vm.
#
# Two steps, and the order matters. The instance metadata is the recipe; the
# files on the VM are its output. Running the script runner WITHOUT pushing
# metadata first silently re-applies the previous recipe and still reports
# "exit status 0" -- which has already cost us two debugging rounds, once on
# the hostname and once on the OIDC provider URL. Always use this script
# rather than running either half by hand.
set -euo pipefail

VM=webknossos-vm
ZONE=us-east1-b
PROJECT=the-pulsar-481518-f3
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

echo ">> pushing $HERE/startup.sh into instance metadata"
gcloud compute instances add-metadata "$VM" \
  --zone="$ZONE" --project="$PROJECT" \
  --metadata-from-file startup-script="$HERE/startup.sh"

echo ">> running it on $VM"
gcloud compute ssh "$VM" --zone="$ZONE" --project="$PROJECT" --tunnel-through-iap \
  --command="sudo google_metadata_script_runner startup"
