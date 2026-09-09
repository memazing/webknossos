import AcceptInviteView from "admin/auth/accept_invite_view";
import FinishResetPasswordView from "admin/auth/finish_reset_password_view";
import LoginView from "admin/auth/login_view";
import RegistrationView from "admin/auth/registration_view";
import StartResetPasswordView from "admin/auth/start_reset_password_view";
import VerifyEmailView from "admin/auth/verify_email_view";
import { datasetURLImportLoader } from "admin/dataset/dataset_url_import";
import { PricingPlanEnum } from "admin/organization/pricing_plan_utils";
import { Layout } from "antd";
import ErrorBoundary from "components/error_boundary";
import SecuredRoute from "components/secured_route";
import loadable from "libs/lazy_loader";
import Navbar from "navbar";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  redirect,
} from "react-router-dom";
import type { EmptyObject } from "types/type_utils";
import { CommandPalette } from "viewer/view/components/command_palette";

const { Content } = Layout;

import { PageNotFoundView } from "./page_not_found_view";
import {
  AnnotationsRouteWrapper,
  CreateExplorativeRouteWrapper,
  DashboardRouteRootWrapper,
  DashboardRouteWrapper,
  DatasetSettingsRouteWrapper,
  OnboardingRouteWrapper,
  RootRouteWrapper,
  ShortLinksRouteWrapper,
  TracingSandboxLegacyRouteWrapper,
  TracingSandboxRouteWrapper,
  TracingViewModeLegacyWrapper,
  TracingViewModeRouteWrapper,
  TracingViewRouteWrapper,
  UserDetailsRouteWrapper,
} from "./route_wrappers";

// Admin and dashboard pages are loaded on demand: none of them is needed to render the
// navbar or the login screen, and together they account for a large part of the entry chunk.
// loadable() adds the Suspense boundary and the stale-chunk error handling (see libs/lazy_loader).
const AccountAuthTokenView = loadable(() => import("admin/account/account_auth_token_view"));
const AccountProfileView = loadable(() => import("admin/account/account_profile_view"));
const AccountSecurityView = loadable(() => import("admin/account/account_security_view"));
const AccountSettingsView = loadable(() => import("admin/account/account_settings_view"));
const AiModelListView = loadable(() => import("admin/voxelytics/ai_model_list_view"));
const AvailableTasksReportView = loadable(
  () => import("admin/statistic/available_tasks_report_view"),
);
const DashboardView = loadable(() => import("dashboard/dashboard_view"));
const DatasetAddView = loadable(() => import("admin/dataset/dataset_add_view"));
const DatasetSettingsDataTab = loadable(
  () => import("dashboard/dataset/dataset_settings_data_tab"),
);
const DatasetSettingsDeleteTab = loadable(
  () => import("dashboard/dataset/dataset_settings_delete_tab"),
);
const DatasetSettingsMetadataTab = loadable(
  () => import("dashboard/dataset/dataset_settings_metadata_tab"),
);
const DatasetSettingsSharingTab = loadable(
  () => import("dashboard/dataset/dataset_settings_sharing_tab"),
);
const DatasetSettingsStorageTab = loadable(
  () => import("dashboard/dataset/dataset_settings_storage_tab"),
);
const DatasetSettingsViewConfigTab = loadable(
  () => import("dashboard/dataset/dataset_settings_viewconfig_tab"),
);
const JobListView = loadable(() => import("admin/job/job_list_view"));
const OrganizationView = loadable(() => import("admin/organization/organization_view"));
const ProjectCreateView = loadable(() => import("admin/project/project_create_view"));
const ProjectListView = loadable(() => import("admin/project/project_list_view"));
const ProjectProgressReportView = loadable(
  () => import("admin/statistic/project_progress_report_view"),
);
const PublicationDetailView = loadable(() => import("dashboard/publication_details_view"));
const ScriptCreateView = loadable(() => import("admin/scripts/script_create_view"));
const ScriptListView = loadable(() => import("admin/scripts/script_list_view"));
const TaskCreateFormView = loadable(() => import("admin/task/task_create_form_view"));
const TaskCreateView = loadable(() => import("admin/task/task_create_view"));
const TaskListView = loadable(() => import("admin/task/task_list_view"));
const TaskTypeCreateView = loadable(() => import("admin/tasktype/task_type_create_view"));
const TaskTypeListView = loadable(() => import("admin/tasktype/task_type_list_view"));
const TeamListView = loadable(() => import("admin/team/team_list_view"));
const TimeTrackingOverview = loadable(() => import("admin/statistic/time_tracking_overview"));
const UserListView = loadable(() => import("admin/user/user_list_view"));
const DatasetURLImport = loadable<EmptyObject>(() =>
  import("admin/dataset/dataset_url_import").then((module) => ({
    default: module.DatasetURLImport,
  })),
);
const Imprint = loadable<EmptyObject>(() =>
  import("components/legal").then((module) => ({ default: module.Imprint })),
);
const OrganizationCreditActivityView = loadable<EmptyObject>(() =>
  import("admin/organization/organization_credit_activity_view").then((module) => ({
    default: module.OrganizationCreditActivityView,
  })),
);
const OrganizationDangerZoneView = loadable<EmptyObject>(() =>
  import("admin/organization/organization_danger_zone_view").then((module) => ({
    default: module.OrganizationDangerZoneView,
  })),
);
const OrganizationNotificationsView = loadable<EmptyObject>(() =>
  import("admin/organization/organization_notifications_view").then((module) => ({
    default: module.OrganizationNotificationsView,
  })),
);
const OrganizationOverviewView = loadable<EmptyObject>(() =>
  import("admin/organization/organization_overview_view").then((module) => ({
    default: module.OrganizationOverviewView,
  })),
);
const OrganizationPlanActivityView = loadable<EmptyObject>(() =>
  import("admin/organization/organization_plan_activity_view").then((module) => ({
    default: module.OrganizationPlanActivityView,
  })),
);
const Privacy = loadable<EmptyObject>(() =>
  import("components/legal").then((module) => ({ default: module.Privacy })),
);

const AsyncWorkflowView = loadable<EmptyObject>(() => import("admin/voxelytics/workflow_view"));
const AsyncWorkflowListView = loadable<EmptyObject>(
  () => import("admin/voxelytics/workflow_list_view"),
);

function RootLayout() {
  return (
    <Layout>
      <CommandPalette />
      <Navbar />
      <Content>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </Content>
    </Layout>
  );
}

const routes = createRoutesFromElements(
  <Route element={<RootLayout />}>
    <Route path="/" element={<RootRouteWrapper />} />
    <Route
      path="/dashboard/:tab"
      element={
        <SecuredRoute>
          <DashboardRouteWrapper />
        </SecuredRoute>
      }
    />

    <Route
      path="/dashboard/datasets/:folderIdWithName"
      element={
        <SecuredRoute>
          <DashboardView userId={null} isAdminView={false} initialTabKey={"datasets"} />
        </SecuredRoute>
      }
    />

    <Route path="/dashboard" element={<DashboardRouteRootWrapper />} />
    <Route
      path="/users/:userId/details"
      element={
        <SecuredRoute requiresAdminOrManagerRole>
          <UserDetailsRouteWrapper />
        </SecuredRoute>
      }
    />
    <Route
      path="/users"
      element={
        <SecuredRoute requiresAdminOrManagerRole>
          <UserListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/import"
      loader={datasetURLImportLoader}
      element={
        <SecuredRoute requiresAdminOrManagerRole>
          <DatasetURLImport />
        </SecuredRoute>
      }
    />
    <Route
      path="/teams"
      element={
        <SecuredRoute requiresAdminOrManagerRole>
          <TeamListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/timetracking"
      element={
        <SecuredRoute>
          <TimeTrackingOverview />
        </SecuredRoute>
      }
    />
    <Route
      path="/reports/projectProgress"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <ProjectProgressReportView />
        </SecuredRoute>
      }
    />
    <Route path="/reports/openTasks" element={<Navigate to="/reports/availableTasks" replace />} />
    <Route
      path="/reports/availableTasks"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <AvailableTasksReportView />
        </SecuredRoute>
      }
    />
    <Route
      path="/tasks"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <TaskListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/tasks/create"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <TaskCreateView />
        </SecuredRoute>
      }
    />
    <Route
      path="/tasks/:taskId/edit"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <TaskCreateFormView />
        </SecuredRoute>
      }
    />
    <Route
      path="/tasks/:taskId"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <TaskListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/projects"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <ProjectListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/projects/create"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <ProjectCreateView />
        </SecuredRoute>
      }
    />
    <Route
      path="/projects/:projectId/tasks"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <TaskListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/projects/:projectId/edit"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <ProjectCreateView />
        </SecuredRoute>
      }
    />
    <Route
      path="/annotations/:type/:id"
      element={
        <SecuredRoute checkIfResourceIsPublic>
          <AnnotationsRouteWrapper />
        </SecuredRoute>
      }
    />
    <Route
      path="/annotations/:id"
      element={
        <SecuredRoute checkIfResourceIsPublic>
          <TracingViewRouteWrapper />
        </SecuredRoute>
      }
    />
    <Route
      path="/datasets/upload"
      element={
        <SecuredRoute requiresAdminOrManagerRole>
          <DatasetAddView />
        </SecuredRoute>
      }
    />

    <Route
      path="/datasets/:datasetNameAndId/edit"
      element={
        <SecuredRoute requiresAdminOrManagerRole>
          <DatasetSettingsRouteWrapper />
        </SecuredRoute>
      }
    >
      <Route index element={<Navigate to="data" replace />} />
      <Route path="data" element={<DatasetSettingsDataTab />} />
      <Route path="sharing" element={<DatasetSettingsSharingTab />} />
      <Route path="metadata" element={<DatasetSettingsMetadataTab />} />
      <Route path="defaultConfig" element={<DatasetSettingsViewConfigTab />} />
      <Route path="storage" element={<DatasetSettingsStorageTab />} />
      <Route path="delete" element={<DatasetSettingsDeleteTab />} />
    </Route>
    <Route
      path="/taskTypes"
      element={
        <SecuredRoute requiresAdminOrManagerRole>
          <TaskTypeListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/taskTypes/create"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <TaskTypeCreateView />
        </SecuredRoute>
      }
    />
    <Route
      path="/taskTypes/:taskTypeId/edit"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <TaskTypeCreateView />
        </SecuredRoute>
      }
    />
    <Route
      path="/taskTypes/:taskTypeId/tasks"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <TaskListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/taskTypes/:taskTypeId/projects"
      element={
        <SecuredRoute requiresAdminOrManagerRole requiredPricingPlan={PricingPlanEnum.Team}>
          <ProjectListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/scripts/create"
      element={
        <SecuredRoute requiresAdminOrManagerRole>
          <ScriptCreateView />
        </SecuredRoute>
      }
    />
    <Route
      path="/scripts/:scriptId/edit"
      element={
        <SecuredRoute requiresAdminOrManagerRole>
          <ScriptCreateView />
        </SecuredRoute>
      }
    />
    <Route
      path="/scripts"
      element={
        <SecuredRoute requiresAdminOrManagerRole>
          <ScriptListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/jobs"
      element={
        <SecuredRoute>
          <JobListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/organizations/:organizationId"
      element={<Navigate to="/organization" replace />}
    />
    <Route
      path="/organization"
      element={
        <SecuredRoute>
          <OrganizationView />
        </SecuredRoute>
      }
    >
      <Route index element={<Navigate to="overview" replace />} />
      <Route path="overview" element={<OrganizationOverviewView />} />
      <Route path="notifications" element={<OrganizationNotificationsView />} />
      <Route path="credit-activity" element={<OrganizationCreditActivityView />} />
      <Route path="planupdates" element={<OrganizationPlanActivityView />} />
      <Route path="delete" element={<OrganizationDangerZoneView />} />
    </Route>
    <Route
      path="/help/keyboardshortcuts"
      loader={() => redirect("https://docs.webknossos.org/webknossos/ui/keyboard_shortcuts.html")}
    />
    {/* Backwards compatibility for old auth token URLs */}
    <Route path="/auth/token" element={<Navigate to="/account/token" replace />} />
    {/* Backwards compatibility for old password change URLs */}
    <Route path="/auth/changePassword" element={<Navigate to="/account/security" replace />} />
    <Route path="/account/password" element={<Navigate to="/account/security" replace />} />
    <Route path="/login" element={<Navigate to="/auth/login" replace />} />

    <Route path="/invite/:token" element={<AcceptInviteView />} />

    <Route path="/verifyEmail/:token" element={<VerifyEmailView />} />
    {/* Backwards compatibility for signup URLs */}
    <Route path="/signup" element={<Navigate to="/auth/signup" replace />} />
    {/* Backwards compatibility for register URLs */}
    <Route path="/register" element={<Navigate to="/auth/signup" replace />} />
    {/* Backwards compatibility for register URLs */}
    <Route path="/auth/register" element={<Navigate to="/auth/signup" replace />} />
    <Route path="/auth/login" element={<LoginView />} />
    <Route path="/auth/signup" element={<RegistrationView />} />

    <Route path="/auth/resetPassword" element={<StartResetPasswordView />} />
    <Route path="/auth/finishResetPassword" element={<FinishResetPasswordView />} />
    {/* legacy view mode route */}
    <Route
      path="/datasets/:organizationId/:datasetName/view"
      element={<TracingViewModeLegacyWrapper />}
    />
    <Route path="/datasets/:datasetNameAndId/view" element={<TracingViewModeRouteWrapper />} />
    <Route
      path="/datasets/:datasetNameAndId/sandbox/:type"
      element={<TracingSandboxRouteWrapper />}
    />
    {/* legacy sandbox route */}
    <Route
      path="/datasets/:organizationId/:datasetName/sandbox/:type"
      element={<TracingSandboxLegacyRouteWrapper />}
    />
    <Route
      path="/datasets/:datasetId/createExplorative/:type"
      element={
        <SecuredRoute>
          <CreateExplorativeRouteWrapper />
        </SecuredRoute>
      }
    />
    {
      // Note that this route has to be beneath all others sharing the same prefix,
      // to avoid url mismatching
    }
    {/*legacy view mode route */}
    <Route
      path="/datasets/:organizationId/:datasetName"
      element={<TracingViewModeLegacyWrapper />}
    />
    <Route path="/datasets/:datasetNameAndId" element={<TracingViewModeRouteWrapper />} />
    <Route path="/publications/:id" element={<PublicationDetailView />} />
    <Route
      path="/publication/:id"
      loader={({ params }) => redirect(`/publications/${params.id}`)}
    />
    <Route
      path="/workflows"
      element={
        <SecuredRoute>
          <AsyncWorkflowListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/aiModels"
      element={
        <SecuredRoute>
          <AiModelListView />
        </SecuredRoute>
      }
    />
    <Route
      path="/workflows/:workflowHash"
      loader={({ params, request }) => {
        const url = new URL(request.url);
        const runId = url.searchParams.get("runId");
        if (runId) {
          url.searchParams.delete("runId");
          const search = url.searchParams.toString();

          return redirect(
            `/workflows/${params.workflowHash}/run/${encodeURIComponent(runId)}${search ? `?${search}` : ""}`,
          );
        }
        return null;
      }}
      element={
        <SecuredRoute>
          <AsyncWorkflowView />
        </SecuredRoute>
      }
    />
    <Route
      path="/workflows/:workflowHash/run/:runId"
      element={
        <SecuredRoute>
          <AsyncWorkflowView />
        </SecuredRoute>
      }
    />
    <Route path="/imprint" element={<Imprint />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/links/:key" element={<ShortLinksRouteWrapper />} />
    <Route path="/onboarding" element={<OnboardingRouteWrapper />} />
    <Route
      path="/account"
      element={
        <SecuredRoute>
          <AccountSettingsView />
        </SecuredRoute>
      }
    >
      <Route index element={<Navigate to="profile" replace />} />
      <Route path="profile" element={<AccountProfileView />} />
      <Route path="security" element={<AccountSecurityView />} />
      <Route path="token" element={<AccountAuthTokenView />} />
    </Route>
    <Route path="*" element={<PageNotFoundView />} />
  </Route>,
);

const router = createBrowserRouter(routes);
export default router;
