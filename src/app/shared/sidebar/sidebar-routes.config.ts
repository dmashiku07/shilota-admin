import { RouteInfo } from './sidebar.metadata';

//Sidebar menu Routes and data
export const ROUTES: RouteInfo[] = [
    {
        path: '/admin/dashboard', title: 'Dashboard', icon: 'fa fa-home', class: '', badge: '',
        badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
        ]
    },

    {
        path: '', title: 'Users', icon: 'fa fa-users', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/management/user', title: 'Riders', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/management/driver', title: 'Drivers', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }
        ]
    },

    {
        path: '', title: 'Deleted Accounts', icon: 'fa fa-users', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/management/deletedusers', title: 'Riders', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/management/deleteddrivers', title: 'Drivers', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }
        ]
    },

    {
        path: '/admin/management/vehicle', title: 'Vehicles', icon: 'fa fa-car', class: '', badge: '',
        badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
        ]
    },

    {
        path: '', title: 'Cabs', icon: 'fa fa-taxi', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/bodytype/view', title: 'Body types', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/amenities/view', title: 'Amenities', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/category/view', title: 'Category', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }
        ]

    },

    {
        path: '/admin/management/rides', title: 'Rides', icon: 'fa fa-history', class: '', badge: '',
        badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
        ]
    },

    {
        path: '', title: 'Safety', icon: 'fa fa-shield', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/sos-alerts', title: 'SOS Alerts', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/lost-items', title: 'Lost Items', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/call-logs', title: 'Call Logs', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/rider-blocks', title: 'Rider Blocks', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/demand-heatmap', title: 'Demand Heatmap', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/pool-settings', title: 'Pool Settings', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/acceptance-settings', title: 'Acceptance Settings', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }
        ]
    },

    {
        path: '', title: 'Settings', icon: 'fa fa-sitemap', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/account/website', title: 'Website Settings', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/account/email', title: 'Email Settings', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/account/logo', title: 'Logo Settings', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/account/favicon', title: 'Favicon Settings', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
        ]

    },

    {
        path: '', title: 'Payment', icon: 'fa fa-money', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [

            {
                path: '/admin/account/payment', title: 'Payment Settings', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },

            {
                path: '/admin/commissions/view', title: 'Commissions', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },

            {
                path: '/admin/management/payment', title: 'User Payment', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },

            {
                path: '/admin/management/driverPay', title: 'Driver Payment', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },

            {
                path: '/admin/management/settlementHistory', title: 'Settlement History', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },

        ]

    },

    {
        path: '', title: 'Static Pages', icon: 'fa fa-file-text', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/home/view', title: 'Home Page', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/home/driver', title: 'Driver Home Page', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }
        ]

    },

    {
        path: '/admin/banner/view', title: 'Banners', icon: 'fa fa-file-image-o', class: '', badge: '',
        badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
        ]
    },

    {
        path: '/admin/account/app', title: 'App Store', icon: 'fa fa-cloud-download', class: '', badge: '',
        badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
        ]
    },

    {
        path: '/admin/account/sociallink', title: 'Social Links', icon: 'fa fa-bullhorn', class: '', badge: '',
        badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
        ]
    },

    {
        path: '', title: 'Helps', icon: 'fa fa-info', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/page/view', title: 'Driver', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/page/user', title: 'User', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }
        ]

    },

    {
        path: '/admin/faq/view', title: 'Faq', icon: 'fa fa-question-circle', class: '', badge: '',
        badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
        ]
    },

];
