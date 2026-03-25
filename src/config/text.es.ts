// Spanish text configuration
// Centralized for easy translation management
export const ES = {
  // Auth
  auth: {
    signIn: 'Iniciar Sesión',
    signUp: 'Registrarse',
    createAccount: 'Crear Cuenta',
    email: 'Correo',
    password: 'Contraseña',
    firstName: 'Nombre',
    lastName: 'Apellido',
    salonName: 'Nombre del Salón',
    phone: 'Teléfono',
    logout: 'Cerrar Sesión',
    signInSuccess: '¡Sesión iniciada!',
    createAccountSuccess: '¡Cuenta creada!',
    loginFailed: 'Fallo al iniciar sesión',
    registerFailed: 'Fallo al registrarse',
  },

  // Navigation
  nav: {
    dashboard: 'Panel',
    sessions: 'Sesiones',
    appointments: 'Citas',
    clients: 'Clientes',
    services: 'Servicios',
    staff: 'Personal',
    inventory: 'Inventario',
    reports: 'Reportes',
    settings: 'Configuración',
  },

  // Dashboard
  dashboard: {
    welcome: 'Bienvenido',
    totalRevenue: 'Ingresos Totales',
    sessions: 'Sesiones',
    clients: 'Clientes',
    avgTransaction: 'Transacción Promedio',
    todaySessions: 'Sesiones de Hoy',
    topServices: 'Servicios Principales',
    topStaff: 'Personal Principal',
    myEarnings: 'Mis Ganancias',
    earningsToday: 'Ganancias Hoy',
    servicesCompleted: 'Servicios Completados',
  },

  // Sessions
  sessions: {
    title: 'Sesiones',
    new: '+ Nueva Sesión',
    create: 'Crear Sesión',
    active: 'Activa',
    completed: 'Completada',
    cancelled: 'Cancelada',
    startTime: 'Hora de Inicio',
    endTime: 'Hora de Fin',
    client: 'Cliente',
    totalAmount: 'Monto Total',
    tax: 'Impuesto',
    addService: 'Agregar Servicio',
    closeSession: 'Cerrar Sesión',
    noActiveSessions: 'Sin sesiones activas',
  },

  // Appointments
  appointments: {
    title: 'Citas',
    new: '+ Nueva Cita',
    create: 'Crear Cita',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    noShow: 'No Presentarse',
    cancelled: 'Cancelada',
    filterByDate: 'Filtrar por Fecha',
    forDate: 'Citas para',
    noAppointments: 'Sin citas programadas',
  },

  // Services
  services: {
    title: 'Servicios',
    add: '+ Agregar Servicio',
    name: 'Nombre',
    category: 'Categoría',
    price: 'Precio',
    duration: 'Duración (min)',
    description: 'Descripción',
    haircut: 'Corte',
    coloring: 'Coloración',
    styling: 'Peinado',
    nails: 'Uñas',
    waxing: 'Depilación',
    skincare: 'Cuidado de la Piel',
    massage: 'Masaje',
    other: 'Otro',
    noServices: 'Sin servicios',
  },

  // Staff
  staff: {
    title: 'Personal',
    add: '+ Agregar Personal',
    name: 'Nombre',
    email: 'Correo',
    phone: 'Teléfono',
    role: 'Rol',
    commission: 'Comisión',
    percentage: 'Porcentaje',
    fixed: 'Fijo',
    skills: 'Habilidades',
    availability: 'Disponibilidad',
    available: 'Disponible',
    notAvailable: 'No Disponible',
    teamMembers: 'Miembros del Equipo',
    noStaff: 'Sin personal',
  },

  // Inventory
  inventory: {
    title: 'Inventario',
    add: '+ Agregar Producto',
    name: 'Producto',
    sku: 'SKU',
    category: 'Categoría',
    stock: 'Stock',
    cost: 'Costo',
    price: 'Precio',
    lowStock: 'Stock Bajo',
    products: 'Productos',
    allProducts: 'Todos los Productos',
    noProducts: 'Sin productos',
  },

  // Reports
  reports: {
    title: 'Reportes',
    serviceProfitability: 'Rentabilidad por Servicio',
    staffPerformance: 'Desempeño del Personal',
    materialCost: 'Costo de Materiales',
    profit: 'Ganancia',
    profitMargin: 'Margen de Ganancia',
    startDate: 'Fecha de Inicio',
    endDate: 'Fecha de Fin',
  },

  // Clients
  clients: {
    title: 'Clientes',
    add: '+ Agregar Cliente',
    name: 'Nombre',
    email: 'Correo',
    phone: 'Teléfono',
    dateOfBirth: 'Fecha de Nacimiento',
    notes: 'Notas',
    totalSpent: 'Total Gastado',
    lastVisit: 'Última Visita',
    noClients: 'Sin clientes',
  },

  // Actions
  actions: {
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    view: 'Ver',
    close: 'Cerrar',
    submit: 'Enviar',
    apply: 'Aplicar',
    yes: 'Sí',
    no: 'No',
    loading: 'Cargando...',
    success: '¡Éxito!',
    error: 'Error',
    warning: 'Advertencia',
  },

  // Messages
  messages: {
    fillRequiredFields: 'Por favor complete los campos requeridos',
    operationSuccess: 'Operación exitosa',
    operationFailed: 'Operación fallida',
    confirmDelete: '¿Está seguro de que desea eliminar?',
    noDataFound: 'Sin datos encontrados',
    loadingData: 'Cargando datos...',
  },

  // Roles
  roles: {
    admin: 'Administrador',
    manager: 'Gerente',
    staff: 'Personal',
  },

  // Status
  status: {
    pending: 'Pendiente',
    inProgress: 'En Progreso',
    completed: 'Completado',
    active: 'Activo',
    inactive: 'Inactivo',
  },

  // Material Usage
  material: {
    logUsage: 'Registrar Uso de Material',
    product: 'Producto',
    quantity: 'Cantidad',
    recorded: 'Material registrado',
  },

  // Payments
  payments: {
    processPayment: 'Procesar Pago',
    amount: 'Monto',
    method: 'Método',
    cash: 'Efectivo',
    card: 'Tarjeta',
    qrCode: 'Código QR',
    transfer: 'Transferencia',
    paymentProcessed: 'Pago procesado',
  },
};

export default ES;
