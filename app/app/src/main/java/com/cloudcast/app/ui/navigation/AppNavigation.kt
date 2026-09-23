package com.cloudcast.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.cloudcast.app.data.SettingsStore
import com.cloudcast.app.data.network.EventStream
import com.cloudcast.app.data.repository.AuthRepository
import com.cloudcast.app.data.repository.FileRepository
import com.cloudcast.app.data.repository.FolderRepository
import com.cloudcast.app.data.repository.ShareRepository
import com.cloudcast.app.ui.common.BottomNavBar
import com.cloudcast.app.ui.common.BottomTab
import com.cloudcast.app.ui.auth.LoginScreen
import com.cloudcast.app.ui.auth.AuthViewModel
import com.cloudcast.app.ui.auth.AuthViewModelFactory
import com.cloudcast.app.ui.auth.QrSignIn
import com.cloudcast.app.ui.auth.QrIssueViewModel
import com.cloudcast.app.ui.auth.QrIssueViewModelFactory
import com.cloudcast.app.ui.auth.QrScanViewModel
import com.cloudcast.app.ui.auth.QrScanViewModelFactory
import com.cloudcast.app.ui.filedetail.FileDetailScreen
import com.cloudcast.app.ui.filedetail.FileDetailViewModel
import com.cloudcast.app.ui.filedetail.FileDetailViewModelFactory
import com.cloudcast.app.ui.files.FilesScreen
import com.cloudcast.app.ui.files.FilesViewModel
import com.cloudcast.app.ui.files.FilesViewModelFactory
import com.cloudcast.app.ui.search.SearchScreen
import com.cloudcast.app.ui.search.SearchViewModel
import com.cloudcast.app.ui.search.SearchViewModelFactory
import com.cloudcast.app.ui.notifications.NotificationsViewModel
import com.cloudcast.app.ui.notifications.NotificationsViewModelFactory
import com.cloudcast.app.ui.sharing.SharedHub
import com.cloudcast.app.ui.sharing.SharedHubViewModel
import com.cloudcast.app.ui.sharing.SharedHubViewModelFactory
import com.cloudcast.app.ui.virtualfolders.VirtualFolderMode
import com.cloudcast.app.ui.virtualfolders.VirtualFolderScreen
import com.cloudcast.app.ui.virtualfolders.VirtualFolderViewModel
import com.cloudcast.app.ui.virtualfolders.VirtualFolderViewModelFactory
import com.cloudcast.app.ui.account.ProfileScreen
import com.cloudcast.app.ui.account.ProfileViewModel
import com.cloudcast.app.ui.account.ProfileViewModelFactory

object Routes {
    const val AUTH = "auth"
    const val QR_SCAN = "qr-scan"
    const val FILES = "files"
    const val FILE_DETAIL = "file/{fileId}"
    const val PROFILE = "profile"
    const val SHARED = "shared"
    const val SHARED_WITH_ME = "shared-with-me"
    const val SHARED_BY_ME = "shared-by-me"
    const val EXPIRING = "expiring"
    const val FAVORITES = "favorites"
    const val SEARCH = "search"
    fun fileDetail(id: String) = "file/$id"
}

@Composable
fun AppNavigation(
    authRepository: AuthRepository,
    folderRepository: FolderRepository,
    fileRepository: FileRepository,
    shareRepository: ShareRepository,
    settingsStore: SettingsStore,
    eventStream: EventStream,
    startLoggedIn: Boolean,

    sessionExpired: Flow<Unit> = emptyFlow(),
) {
    val navController = rememberNavController()

    val notificationsVm: NotificationsViewModel = viewModel(
        factory = NotificationsViewModelFactory(fileRepository, eventStream),
    )

    LaunchedEffect(Unit) {
        sessionExpired.collect {
            authRepository.forceSignOut()
            navController.navigate(Routes.AUTH) {
                popUpTo(navController.graph.id) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = if (startLoggedIn) Routes.FILES else Routes.AUTH,
    ) {
        composable(Routes.AUTH) {
            val vm: AuthViewModel = viewModel(factory = AuthViewModelFactory(authRepository))
            LoginScreen(
                viewModel = vm,
                onAuthenticated = {
                    navController.navigate(Routes.FILES) {
                        popUpTo(Routes.AUTH) { inclusive = true }
                    }
                },
                onUseQr = { navController.navigate(Routes.QR_SCAN) },
            )
        }
        composable(Routes.QR_SCAN) {
            val vm: QrScanViewModel = viewModel(factory = QrScanViewModelFactory(authRepository))
            QrSignIn(
                viewModel = vm,
                onBack = { navController.popBackStack() },
                onSignedIn = {
                    navController.navigate(Routes.FILES) {
                        popUpTo(Routes.AUTH) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.FILES) {
            val vm: FilesViewModel = viewModel(
                factory = FilesViewModelFactory(
                    folderRepository, fileRepository, shareRepository,
                    authRepository, eventStream,
                ),
            )
            FilesScreen(
                viewModel = vm,
                notificationsViewModel = notificationsVm,
                onLoggedOut = {
                    navController.navigate(Routes.AUTH) {
                        popUpTo(Routes.FILES) { inclusive = true }
                    }
                },
                onOpenFile = { id -> navController.navigate(Routes.fileDetail(id)) },
                onOpenProfile = { navController.navigate(Routes.PROFILE) },
                onOpenSharedWithMe = { navController.switchTab(Routes.SHARED) },
                onOpenExpiring = { navController.switchTab(Routes.EXPIRING) },
                onOpenFavorites = { navController.switchTab(Routes.FAVORITES) },
                onOpenSearch = { navController.navigate(Routes.SEARCH) },
            )
        }
        composable(
            Routes.FILE_DETAIL,
            arguments = listOf(navArgument("fileId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val fileId = backStackEntry.arguments?.getString("fileId").orEmpty()
            val vm: FileDetailViewModel = viewModel(
                factory = FileDetailViewModelFactory(
                    fileRepository, folderRepository, shareRepository, eventStream, fileId,
                ),
            )
            FileDetailScreen(viewModel = vm, onBack = { navController.popBackStack() })
        }

        composable(Routes.SHARED) {
            val hubVm: SharedHubViewModel = viewModel(
                factory = SharedHubViewModelFactory(shareRepository, fileRepository, eventStream),
            )
            SharedHub(
                onOpenSharedByMe = { navController.navigate(Routes.SHARED_BY_ME) },
                onOpenSharedWithMe = { navController.navigate(Routes.SHARED_WITH_ME) },
                viewModel = hubVm,
                onOpenFile = { id -> navController.navigate(Routes.fileDetail(id)) },
                bottomBar = { TabBottomBar(navController, BottomTab.SHARED) },
                onOpenSearch = { navController.navigate(Routes.SEARCH) },
                onOpenProfile = { navController.navigate(Routes.PROFILE) },
                notificationsViewModel = notificationsVm,
            )
        }

        composable(Routes.SHARED_WITH_ME) {
            val vm: VirtualFolderViewModel = viewModel(
                factory = VirtualFolderViewModelFactory(fileRepository, shareRepository, eventStream, VirtualFolderMode.SHARED_WITH_ME),
            )
            VirtualFolderScreen(
                title = "Shared with me",
                emptyMessage = "Nothing has been shared with you yet.",
                viewModel = vm,
                onBack = { navController.popBackStack() },
                onOpenFile = { id -> navController.navigate(Routes.fileDetail(id)) },
                canBrowseFolders = true,
                incoming = true,
                onOpenSearch = { navController.navigate(Routes.SEARCH) },
                onOpenProfile = { navController.navigate(Routes.PROFILE) },
                notificationsViewModel = notificationsVm,
            )
        }

        composable(Routes.SHARED_BY_ME) {
            val vm: VirtualFolderViewModel = viewModel(
                factory = VirtualFolderViewModelFactory(fileRepository, shareRepository, eventStream, VirtualFolderMode.SHARED_BY_ME),
            )
            VirtualFolderScreen(
                title = "Shared files",
                emptyMessage = "You haven't shared anything yet.",
                viewModel = vm,
                onBack = { navController.popBackStack() },
                onOpenFile = { id -> navController.navigate(Routes.fileDetail(id)) },
                canBrowseFolders = true,

                sharedByMe = true,
                onOpenSearch = { navController.navigate(Routes.SEARCH) },
                onOpenProfile = { navController.navigate(Routes.PROFILE) },
                notificationsViewModel = notificationsVm,
            )
        }

        composable(Routes.EXPIRING) {
            val vm: VirtualFolderViewModel = viewModel(
                factory = VirtualFolderViewModelFactory(fileRepository, shareRepository, eventStream, VirtualFolderMode.EXPIRING),
            )
            VirtualFolderScreen(
                title = "Expiring",
                emptyMessage = "Nothing is set to expire.",
                viewModel = vm,
                onBack = { navController.popBackStack() },
                onOpenFile = { id -> navController.navigate(Routes.fileDetail(id)) },
                bottomBar = { TabBottomBar(navController, BottomTab.EXPIRING) },
                isRootTab = true,
                onOpenSearch = { navController.navigate(Routes.SEARCH) },
                onOpenProfile = { navController.navigate(Routes.PROFILE) },
                notificationsViewModel = notificationsVm,
            )
        }

        composable(Routes.FAVORITES) {
            val vm: VirtualFolderViewModel = viewModel(
                factory = VirtualFolderViewModelFactory(fileRepository, shareRepository, eventStream, VirtualFolderMode.FAVORITES),
            )
            VirtualFolderScreen(
                title = "Favourites",
                emptyMessage = "You haven't favourited anything yet.",
                viewModel = vm,
                onBack = { navController.popBackStack() },
                onOpenFile = { id -> navController.navigate(Routes.fileDetail(id)) },
                bottomBar = { TabBottomBar(navController, BottomTab.FAVOURITES) },
                isRootTab = true,
                onOpenSearch = { navController.navigate(Routes.SEARCH) },
                onOpenProfile = { navController.navigate(Routes.PROFILE) },
                notificationsViewModel = notificationsVm,
            )
        }

        composable(Routes.SEARCH) {
            val vm: SearchViewModel = viewModel(
                factory = SearchViewModelFactory(
                    fileRepository, folderRepository, shareRepository, eventStream,
                ),
            )
            SearchScreen(
                viewModel = vm,
                onBack = { navController.popBackStack() },
                onOpenFile = { id -> navController.navigate(Routes.fileDetail(id)) },
            )
        }

        composable(Routes.PROFILE) {
            val vm: ProfileViewModel = viewModel(factory = ProfileViewModelFactory(authRepository, settingsStore, fileRepository))

            val qrIssueVm: QrIssueViewModel = viewModel(factory = QrIssueViewModelFactory(authRepository))
            ProfileScreen(
                viewModel = vm,
                qrIssueViewModel = qrIssueVm,
                onBack = { navController.popBackStack() },
                onLoggedOut = {
                    navController.navigate(Routes.AUTH) {
                        popUpTo(Routes.FILES) { inclusive = true }
                    }
                },
            )
        }
    }
}

private fun NavController.switchTab(route: String) {
    navigate(route) {
        popUpTo(Routes.FILES) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

@Composable
private fun TabBottomBar(navController: NavController, selected: BottomTab) {
    BottomNavBar(
        selected = selected,
        onSelect = { tab ->
            navController.switchTab(
                when (tab) {
                    BottomTab.FILES -> Routes.FILES
                    BottomTab.FAVOURITES -> Routes.FAVORITES
                    BottomTab.SHARED -> Routes.SHARED
                    BottomTab.EXPIRING -> Routes.EXPIRING
                }
            )
        },
    )
}
