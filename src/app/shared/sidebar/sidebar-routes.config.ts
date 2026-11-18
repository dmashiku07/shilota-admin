import { RouteInfo } from './sidebar.metadata';
import { environment } from '../../../environments/environment';

//Sidebar menu Routes and data
export const ROUTES: RouteInfo[] = [
    {
        path: '/admin/dashboard', title: 'Dashboard', icon: 'fa fa-home', class: '', badge: '',
        badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
        ]
    },

    {
        path: '', title: 'Passenger Management', icon: 'fa fa-users', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/management/user', title: 'All Passengers', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/management/deletedusers', title: 'Deleted Passenger Accounts', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }
        ]
    },

    {
        path: '', title: 'Driver Management', icon: 'fa fa-id-card-o', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/management/driver', title: 'All Drivers', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/management/deleteddrivers', title: 'Deleted Driver Accounts', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }
        ]
    },

    {
        path: '', title: 'Vehicle & Fleet Management', icon: 'fa fa-car', class: 'has-sub', badge: '',
        badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            { path: '/admin/management/vehicle', title: 'Vehicles', icon: '', class: '', badge: '', badgeClass: '', isExternalLink: false, submenu: [] },
            { path: '/admin/bodytype/view', title: 'Body Types', icon: '', class: '', badge: '', badgeClass: '', isExternalLink: false, submenu: [] },
            { path: '/admin/amenities/view', title: 'Amenities', icon: '', class: '', badge: '', badgeClass: '', isExternalLink: false, submenu: [] },
            { path: '/admin/category/view', title: 'Vehicle Categories', icon: '', class: '', badge: '', badgeClass: '', isExternalLink: false, submenu: [] }
        ]
    },

    {
        path: '', title: 'Ride & Trip Management', icon: 'fa fa-road', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/management/rides', title: 'Rides', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/destination-broadcast-monitor', title: 'Destination Broadcasts', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/price-broadcast-settings', title: 'Price Broadcast Settings', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/pool-settings', title: 'Pool Settings', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }
        ]

    },

    {
        path: '', title: 'Payments & Finance', icon: 'fa fa-money', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/management/disbursements', title: 'Disbursements', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            ...(environment.featureFlags.commission_enabled ? [{
                path: '/admin/commissions/view', title: 'Commission Settings', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/management/driverPay', title: 'Driver Payments', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/management/settlementHistory', title: 'Settlement History', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }] : [])
        ]
    },

    {
        path: '', title: 'Receipts & Transactions', icon: 'fa fa-file-text-o', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/management/receipts', title: 'Payment & Ride Receipts', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }
        ]
    },

    {
        path: '', title: 'Reports & Analytics', icon: 'fa fa-line-chart', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/reports', title: 'Platform Reports', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/demand-heatmap', title: 'Demand Heatmap', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/management/latra', title: 'LATRA Compliance', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            }
        ]
    },

    {
        path: '', title: 'Safety & Emergencies', icon: 'fa fa-shield', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/sos-alerts', title: 'Emergency Alerts', icon: '', class: '',
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
            }
        ]
    },

    {
        path: '', title: 'System Settings', icon: 'fa fa-sitemap', class: 'has-sub',
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
        path: '', title: 'Subscriptions', icon: 'fa fa-credit-card', class: 'has-sub',
        badge: '', badgeClass: 'badge badge-pill badge-danger float-right mr-1 mt-1', isExternalLink: false, submenu: [
            {
                path: '/admin/subscription-plans/view', title: 'Driver Subscription Plans', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },

            {
                path: '/admin/subscription-plans/view?customer_type=PASSENGER', title: 'Passenger Subscription Plans', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },

            {
                path: '/admin/driver-subscriptions/view', title: 'Driver Subscriptions', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
            {
                path: '/admin/driver-subscriptions/view?customer_type=PASSENGER', title: 'Passenger Subscriptions', icon: '', class: '',
                badge: '', badgeClass: '', isExternalLink: false, submenu: []
            },
        ]

    },

];
