<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { QuillEditor } from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";
import * as XLSX from "xlsx";

const { t } = useI18n();
const router = useRouter();

// 1. Auth & Identity
const userRole = computed(() => localStorage.getItem("admin_role") || "editor");
const isSuperuser = computed(() => userRole.value === "superuser");
const userEmail = computed(() => localStorage.getItem("admin_email"));

// 2. Basic Data Refs
const properties = ref([]);
const blogPosts = ref([]);
const users = ref([]);
const contactMessages = ref([]);
const researchListings = ref([]);
const buyers = ref([]);
const isEditingResearch = ref(false);
const showResearchForm = ref(false);

const conciergeProperties = ref([]);
const selectedConciergeProperty = ref(null);
const showConciergeForm = ref(false);
const isEditingConcierge = ref(false);
const editingConciergeId = ref(null);
const isSyncingConcierge = ref(false);
const newConcierge = ref({ title: "", address: "", owner_name: "", owner_email: "", airbnb_cleaning_fee: null, max_cleaning_duration: null });
const emailReportPeriod = ref({
  type: "selected", // 'all', 'selected', or 'custom'
  month: new Date().getMonth(),
  year: new Date().getFullYear()
});

const reportsFilter = ref({
  search: "",
  status: "all",
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1
});
const reportsPerPage = ref(10);
const reportsCurrentPage = ref(1);


const showConciergeDetailsModal = ref(false);
const selectedConciergeDetailsProperty = ref(null);
const propertyDetailsTab = ref('calendar'); // 'calendar', 'bookings', 'reservation-form'
const overlappingBookingsToOverwrite = ref([]);
const propertyDetailsFilterYear = ref(new Date().getFullYear());
const propertyDetailsFilterMonth = ref(new Date().getMonth() + 1);
const showBookingModal = ref(false);
const selectedBookingProperty = ref(null);
const newBooking = ref({ start_date: "", end_date: "", guest_name: "", price: null, notes: "" });
const showBookingDetailsModal = ref(false);
const selectedBookingDetail = ref(null);

const showQuickBookingModal = ref(false);
const quickBookingPropertyId = ref(null);

const currentConciergeView = ref('calendar');
const dashboardPropertyId = ref('all');
const dashboardYear = ref(new Date().getFullYear());
const dashboardHoveredMonth = ref(null);
const dashboardShowGross = ref(true);
const dashboardShowDoorman = ref(true);
const bookingForm = ref({
  id: null,
  start_date: "",
  end_date: "",
  guest_name: "",
  price: 0,
  platform: "resaoff",
  platform_fee: 0,
  commission_rate: 20,
  notes: "",
  is_block: false
});


// Cleaning management state
const cleaners = ref([]);
const cleaningAssignments = ref([]);
const allCleaningAssignments = ref([]);
const deletedCleanings = ref(JSON.parse(localStorage.getItem('deleted_cleanings') || '[]'));
const cleaningSelectedDate = ref(new Date().toISOString().slice(0, 10));
const newCleanerForm = ref({ name: "", hourly_rate: null });
const isEditingCleaner = ref(false);
const editingCleanerId = ref(null);
const cleaningNote = ref({});
const cleanerSelectedProperty = reactive({});
const cleanerAssignmentNote = reactive({});

// Cleaning Report state
const cleaningReportYear = ref(new Date().getFullYear());
const cleaningReportMonth = ref(new Date().getMonth() + 1); // 1-12
const cleaningReportCleanerId = ref(''); // '' means all
const reportCleaningAssignments = ref([]);
const cleanerTransactions = ref([]);
const showTransactionsManager = ref(false);
const cleaningReportSubView = ref('wages'); // 'wages' or 'transactions'

const newTransactionForm = ref({
  cleaner_id: "",
  property_id: "",
  amount: null,
  type: "expense", // 'expense' or 'advance'
  transaction_date: new Date().toISOString().slice(0, 10),
  description: ""
});

const fetchReportCleaningAssignments = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/cleaning-assignments/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      reportCleaningAssignments.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch report cleaning assignments", err);
  }
};

const fetchCleanerTransactions = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/cleaner-transactions/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      cleanerTransactions.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch cleaner transactions", err);
  }
};

const addCleanerTransaction = async () => {
  if (!newTransactionForm.value.cleaner_id || !newTransactionForm.value.amount || !newTransactionForm.value.transaction_date) {
    alert("Please fill name and amount.");
    return;
  }
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/cleaner-transactions/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        cleaner_id: parseInt(newTransactionForm.value.cleaner_id),
        property_id: newTransactionForm.value.property_id ? parseInt(newTransactionForm.value.property_id) : null,
        amount: parseFloat(newTransactionForm.value.amount),
        type: newTransactionForm.value.type,
        transaction_date: newTransactionForm.value.transaction_date,
        description: newTransactionForm.value.description.trim() || null
      })
    });
    if (res.ok) {
      newTransactionForm.value = {
        cleaner_id: "",
        property_id: "",
        amount: null,
        type: "expense",
        transaction_date: new Date().toISOString().slice(0, 10),
        description: ""
      };
      await fetchCleanerTransactions();
      showTransactionsManager.value = false;
    } else {
      const errData = await res.json().catch(() => ({}));
      alert(`Failed to add transaction: ${errData.detail || res.statusText}`);
    }
  } catch (err) {
    console.error("Failed to add transaction", err);
    alert("Failed to add transaction.");
  }
};

const deleteCleanerTransaction = async (id) => {
  if (!confirm("Are you sure you want to delete this transaction?")) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/cleaner-transactions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok || res.status === 204) {
      await fetchCleanerTransactions();
    }
  } catch (err) {
    console.error("Failed to delete transaction", err);
  }
};

// 1. Summary of Salaries, Expenses, Advances and Net Payouts per Cleaner
const cleanerSalarySummary = computed(() => {
  const year = cleaningReportYear.value;
  const month = cleaningReportMonth.value;

  // Filter assignments for selected month
  const monthAssignments = reportCleaningAssignments.value.filter(a => {
    const d = new Date(a.cleaning_date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  // Filter transactions for selected month
  const monthTransactions = cleanerTransactions.value.filter(t => {
    const d = new Date(t.transaction_date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  return cleaners.value.map(cleaner => {
    const assignments = monthAssignments.filter(a => a.cleaner_id === cleaner.id);
    const transactions = monthTransactions.filter(t => t.cleaner_id === cleaner.id);
    // Calculate total hours and wage per assignment historically
    let totalHours = 0;
    let wage = 0;
    for (const a of assignments) {
      const prop = conciergeProperties.value.find(p => p.id === a.property_id);
      const duration = a.max_cleaning_duration !== null && a.max_cleaning_duration !== undefined 
        ? parseFloat(a.max_cleaning_duration) 
        : parseFloat(prop?.max_cleaning_duration || 0);
      const aRate = a.hourly_rate !== null && a.hourly_rate !== undefined 
        ? parseFloat(a.hourly_rate) 
        : parseFloat(cleaner.hourly_rate || 0);
      totalHours += duration;
      wage += duration * aRate;
    }

    const otherExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const marketExpenses = transactions.filter(t => t.type === "market").reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const laundryExpenses = transactions.filter(t => t.type === "laundry").reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const expenses = otherExpenses + marketExpenses + laundryExpenses;
    const advances = transactions.filter(t => t.type === "advance").reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const netPayout = wage + expenses - advances;

    return {
      cleaner,
      cleaningsCount: assignments.length,
      totalHours,
      rate: parseFloat(cleaner.hourly_rate || 0),
      wage,
      otherExpenses,
      marketExpenses,
      laundryExpenses,
      expenses,
      advances,
      netPayout,
      hasActivity: assignments.length > 0 || transactions.length > 0
    };
  }).filter(s => s.hasActivity);
});

// 2. Full List of Cleaning Assignments
const filteredCleaningAssignmentsList = computed(() => {
  const year = cleaningReportYear.value;
  const month = cleaningReportMonth.value;
  const selectedCleanerId = cleaningReportCleanerId.value;

  let assignments = reportCleaningAssignments.value.filter(a => {
    const d = new Date(a.cleaning_date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  if (selectedCleanerId) {
    assignments = assignments.filter(a => a.cleaner_id === parseInt(selectedCleanerId));
  }

  // Sort by date ascending
  assignments.sort((a, b) => new Date(a.cleaning_date) - new Date(b.cleaning_date));

  const getYYYYMMDD = (dVal) => {
    if (!dVal) return "";
    const d = new Date(dVal);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const assignmentOtherExpenseMap = new Map();
  const assignmentMarketExpenseMap = new Map();
  const assignmentLaundryExpenseMap = new Map();
  const assignmentAdvanceMap = new Map();
  const assignmentKey = (a) => `${a.cleaner_id}|${a.property_id}|${getYYYYMMDD(a.cleaning_date)}`;
  const monthlyKey = (a) => `${a.cleaner_id}|${a.property_id}`;
  const exactAssignmentKeys = new Set(assignments.map(assignmentKey));
  const firstMonthlyAssignment = new Map();

  assignments.forEach((a) => {
    const key = monthlyKey(a);
    if (!firstMonthlyAssignment.has(key)) {
      firstMonthlyAssignment.set(key, assignmentKey(a));
    }
  });

  cleanerTransactions.value
    .filter((t) => {
      const d = new Date(t.transaction_date);
      const matchesSelectedCleaner = !selectedCleanerId || t.cleaner_id === parseInt(selectedCleanerId);
      return (
        ["expense", "market", "laundry", "advance"].includes(t.type) &&
        d.getFullYear() === year &&
        d.getMonth() + 1 === month &&
        matchesSelectedCleaner
      );
    })
    .forEach((t) => {
      const exactKey = `${t.cleaner_id}|${t.property_id || ''}|${getYYYYMMDD(t.transaction_date)}`;
      const fallbackKey = firstMonthlyAssignment.get(`${t.cleaner_id}|${t.property_id || ''}`);
      const key = exactAssignmentKeys.has(exactKey) ? exactKey : fallbackKey;
      if (!key) return;
      
      const amt = parseFloat(t.amount || 0);
      if (t.type === "expense") {
        assignmentOtherExpenseMap.set(key, (assignmentOtherExpenseMap.get(key) || 0) + amt);
      } else if (t.type === "market") {
        assignmentMarketExpenseMap.set(key, (assignmentMarketExpenseMap.get(key) || 0) + amt);
      } else if (t.type === "laundry") {
        assignmentLaundryExpenseMap.set(key, (assignmentLaundryExpenseMap.get(key) || 0) + amt);
      } else if (t.type === "advance") {
        assignmentAdvanceMap.set(key, (assignmentAdvanceMap.get(key) || 0) + amt);
      }
    });

  return assignments.map(a => {
    const cleaner = cleaners.value.find(c => c.id === a.cleaner_id);
    const prop = conciergeProperties.value.find(p => p.id === a.property_id);

    const duration = a.max_cleaning_duration !== null && a.max_cleaning_duration !== undefined 
      ? parseFloat(a.max_cleaning_duration) 
      : parseFloat(prop?.max_cleaning_duration || 0);

    const rate = a.hourly_rate !== null && a.hourly_rate !== undefined 
      ? parseFloat(a.hourly_rate) 
      : parseFloat(cleaner?.hourly_rate || 0);

    const wage = duration * rate;

    const airbnb_fee = a.airbnb_cleaning_fee !== null && a.airbnb_cleaning_fee !== undefined 
      ? parseFloat(a.airbnb_cleaning_fee) 
      : parseFloat(prop?.airbnb_cleaning_fee || 0);

    const other_expense = assignmentOtherExpenseMap.get(assignmentKey(a)) || 0;
    const market_expense = assignmentMarketExpenseMap.get(assignmentKey(a)) || 0;
    const laundry_expense = assignmentLaundryExpenseMap.get(assignmentKey(a)) || 0;
    const advance = assignmentAdvanceMap.get(assignmentKey(a)) || 0;
    const expenses_sum = other_expense + market_expense + laundry_expense;
    const total_cost = wage + expenses_sum;

    return {
      id: a.id,
      date: a.cleaning_date,
      cleaner_id: a.cleaner_id,
      property_id: a.property_id,
      cleaner_name: cleaner?.name || '—',
      property_title: prop?.title || '—',
      property_address: prop?.address || '',
      duration,
      rate,
      wage,
      other_expense,
      market_expense,
      laundry_expense,
      advance,
      expenses_sum,
      airbnb_fee,
      total_cost,
      notes: a.notes || ''
    };
  });
});

// 3. Filtered transactions list (Expenses & Advances)
const filteredTransactionsList = computed(() => {
  const year = cleaningReportYear.value;
  const month = cleaningReportMonth.value;
  const selectedCleanerId = cleaningReportCleanerId.value;

  let txs = cleanerTransactions.value.filter(t => {
    const d = new Date(t.transaction_date);
    return t.type !== 'payment' && d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  if (selectedCleanerId) {
    txs = txs.filter(t => t.cleaner_id === parseInt(selectedCleanerId));
  }

  // Sort by date ascending
  txs.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));

  return txs.map(t => {
    const cleaner = cleaners.value.find(c => c.id === t.cleaner_id);
    const prop = conciergeProperties.value.find(p => p.id === t.property_id);
    return {
      ...t,
      cleaner_name: cleaner?.name || '—',
      property_title: prop?.title || ''
    };
  });
});

// Cleaner cumulative balance and payment tracking
const showAddPaymentModal = ref(false);
const paymentFilterCleanerId = ref("");
const paymentFilterYear = ref("all");
const paymentFilterMonth = ref("all");

const paymentForm = ref({
  cleaner_id: "",
  amount: null,
  transaction_date: new Date().toISOString().slice(0, 10),
  description: "Bank Transfer",
  notes: ""
});

const cleanerCumulativeBalances = computed(() => {
  return cleaners.value.map(cleaner => {
    // 1. All assignments
    const assignments = reportCleaningAssignments.value.filter(a => a.cleaner_id === cleaner.id);
    let totalWages = 0;
    for (const a of assignments) {
      const prop = conciergeProperties.value.find(p => p.id === a.property_id);
      const duration = a.max_cleaning_duration !== null && a.max_cleaning_duration !== undefined 
        ? parseFloat(a.max_cleaning_duration) 
        : parseFloat(prop?.max_cleaning_duration || 0);
      const aRate = a.hourly_rate !== null && a.hourly_rate !== undefined 
        ? parseFloat(a.hourly_rate) 
        : parseFloat(cleaner.hourly_rate || 0);
      totalWages += duration * aRate;
    }

    // 2. All transactions
    const transactions = cleanerTransactions.value.filter(t => t.cleaner_id === cleaner.id);
    const totalExpenses = transactions.filter(t => ['expense', 'market', 'laundry'].includes(t.type)).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const totalAdvances = transactions.filter(t => t.type === 'advance').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const totalPaid = transactions.filter(t => t.type === 'payment').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    
    const accumulatedBalance = totalWages + totalExpenses - totalAdvances - totalPaid;

    return {
      cleaner,
      totalWages,
      totalExpenses,
      totalAdvances,
      totalPaid,
      accumulatedBalance
    };
  });
});

const filteredPaymentsHistory = computed(() => {
  let txs = cleanerTransactions.value.filter(t => t.type === 'payment');
  
  if (paymentFilterCleanerId.value) {
    txs = txs.filter(t => t.cleaner_id === parseInt(paymentFilterCleanerId.value));
  }
  
  if (paymentFilterYear.value !== 'all') {
    txs = txs.filter(t => new Date(t.transaction_date).getFullYear() === parseInt(paymentFilterYear.value));
  }
  
  if (paymentFilterMonth.value !== 'all') {
    txs = txs.filter(t => new Date(t.transaction_date).getMonth() === parseInt(paymentFilterMonth.value));
  }
  
  // Sort payments by date descending (newest payments first)
  return txs.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
});

const isEditingPayment = ref(false);
const editingPaymentId = ref(null);

const startEditPayment = (payment) => {
  const parts = payment.description.split(' - ');
  const method = ['Bank Transfer', 'Cash Payment'].includes(parts[0]) ? parts[0] : 'Bank Transfer';
  const notes = parts.slice(1).join(' - ');

  paymentForm.value = {
    cleaner_id: payment.cleaner_id,
    amount: parseFloat(payment.amount),
    transaction_date: payment.transaction_date,
    description: method,
    notes: notes
  };
  editingPaymentId.value = payment.id;
  isEditingPayment.value = true;
  showAddPaymentModal.value = true;
};

const cancelAddPayment = () => {
  paymentForm.value = {
    cleaner_id: "",
    amount: null,
    transaction_date: new Date().toISOString().slice(0, 10),
    description: "Bank Transfer",
    notes: ""
  };
  isEditingPayment.value = false;
  editingPaymentId.value = null;
  showAddPaymentModal.value = false;
};

const addCleanerPayment = async () => {
  if (!paymentForm.value.cleaner_id || !paymentForm.value.amount || !paymentForm.value.transaction_date) {
    alert("Please fill all required fields.");
    return;
  }
  const token = localStorage.getItem("admin_token");
  const url = isEditingPayment.value 
    ? `${backendUrl}/cleaner-transactions/${editingPaymentId.value}`
    : `${backendUrl}/cleaner-transactions/`;
  const method = isEditingPayment.value ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        cleaner_id: parseInt(paymentForm.value.cleaner_id),
        property_id: null,
        amount: parseFloat(paymentForm.value.amount),
        type: "payment",
        transaction_date: paymentForm.value.transaction_date,
        description: `${paymentForm.value.description}${paymentForm.value.notes ? ' - ' + paymentForm.value.notes.trim() : ''}`
      })
    });
    if (res.ok) {
      paymentForm.value = {
        cleaner_id: "",
        amount: null,
        transaction_date: new Date().toISOString().slice(0, 10),
        description: "Bank Transfer",
        notes: ""
      };
      isEditingPayment.value = false;
      editingPaymentId.value = null;
      showAddPaymentModal.value = false;
      await fetchCleanerTransactions();
    } else {
      const errData = await res.json().catch(() => ({}));
      alert(`Failed to save payment: ${errData.detail || res.statusText}`);
    }
  } catch (err) {
    console.error("Failed to save payment", err);
    alert("Failed to save payment.");
  }
};

// Edit cleaning assignment state and methods
const showEditAssignmentModal = ref(false);
const editAssignmentForm = ref({
  id: null,
  cleaner_id: "",
  property_id: "",
  date: "",
  notes: "",
  hourly_rate: null,
  max_cleaning_duration: null,
  airbnb_cleaning_fee: null,
  // Extra transactions to add alongside the assignment edit
  market_amount: null,
  laundry_amount: null,
  advance_amount: null,
  expense_description: ""
});

const startEditCleaningAssignment = (row) => {
  editAssignmentForm.value = {
    id: row.id,
    cleaner_id: row.cleaner_id,
    property_id: row.property_id,
    date: row.date,
    notes: row.notes || "",
    hourly_rate: row.rate,
    max_cleaning_duration: row.duration,
    airbnb_cleaning_fee: row.airbnb_fee,
    market_amount: row.market_expense > 0 ? row.market_expense : null,
    laundry_amount: row.laundry_expense > 0 ? row.laundry_expense : null,
    advance_amount: row.advance > 0 ? row.advance : null,
    expense_description: ""
  };
  showEditAssignmentModal.value = true;
};

const saveEditedCleaningAssignment = async () => {
  if (!editAssignmentForm.value.id || editAssignmentForm.value.max_cleaning_duration === null || editAssignmentForm.value.max_cleaning_duration === undefined) {
    alert("Please enter a valid cleaning duration.");
    return;
  }
  const token = localStorage.getItem("admin_token");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  try {
    // 1. Save the core assignment fields
    const res = await fetch(`${backendUrl}/cleaning-assignments/${editAssignmentForm.value.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        cleaner_id: parseInt(editAssignmentForm.value.cleaner_id),
        property_id: parseInt(editAssignmentForm.value.property_id),
        notes: editAssignmentForm.value.notes ? editAssignmentForm.value.notes.trim() : null,
        hourly_rate: parseFloat(editAssignmentForm.value.hourly_rate || 0),
        max_cleaning_duration: parseFloat(editAssignmentForm.value.max_cleaning_duration),
        airbnb_cleaning_fee: parseFloat(editAssignmentForm.value.airbnb_cleaning_fee || 0)
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      alert(`Failed to save changes: ${errData.detail || res.statusText}`);
      return;
    }

    // 2. Save optional extra transactions (market, laundry, advance)
    const txDate = editAssignmentForm.value.date
      ? new Date(editAssignmentForm.value.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const cleanerId = parseInt(editAssignmentForm.value.cleaner_id);
    const propertyId = parseInt(editAssignmentForm.value.property_id);
    const desc = editAssignmentForm.value.expense_description?.trim() || null;

    const extras = [];
    if (editAssignmentForm.value.market_amount > 0) {
      extras.push({ type: 'market', amount: parseFloat(editAssignmentForm.value.market_amount), cleaner_id: cleanerId, property_id: propertyId, transaction_date: txDate, description: desc });
    }
    if (editAssignmentForm.value.laundry_amount > 0) {
      extras.push({ type: 'laundry', amount: parseFloat(editAssignmentForm.value.laundry_amount), cleaner_id: cleanerId, property_id: propertyId, transaction_date: txDate, description: desc });
    }
    if (editAssignmentForm.value.advance_amount > 0) {
      extras.push({ type: 'advance', amount: parseFloat(editAssignmentForm.value.advance_amount), cleaner_id: cleanerId, property_id: propertyId, transaction_date: txDate, description: desc });
    }

    for (const tx of extras) {
      await fetch(`${backendUrl}/cleaner-transactions/`, {
        method: "POST",
        headers,
        body: JSON.stringify(tx)
      });
    }

    showEditAssignmentModal.value = false;
    await fetchReportCleaningAssignments();
    await fetchCleanerTransactions();
  } catch (err) {
    console.error("Failed to update assignment", err);
    alert("Failed to save changes.");
  }
};

const nightsCount = computed(() => {
  if (!bookingForm.value.start_date || !bookingForm.value.end_date) return 0;
  const s = new Date(bookingForm.value.start_date);
  const e = new Date(bookingForm.value.end_date);
  const diff = e - s;
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

const payoutBreakdown = computed(() => {
  const p = parseFloat(bookingForm.value.price || 0);
  const pf = parseFloat(bookingForm.value.platform_fee || 0);
  const cr = parseFloat(bookingForm.value.commission_rate || 20);
  const nights = nightsCount.value || 1;
  
  const net = Math.max(0, p - pf);
  const doorman = net * (cr / 100);
  const owner = net - doorman;
  const nightly = p > 0 && nights > 0 ? (p / nights) : 0;
  
  return {
    net: net.toFixed(2),
    doorman: doorman.toFixed(2),
    owner: owner.toFixed(2),
    nightly: nightly.toFixed(2)
  };
});

const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth());

// Reservations list view state
const reservationListFilter = ref({ property: 'all', platform: 'all', search: '', year: 'all', month: 'all' });
const reservationsPerPage = ref(10);
const reservationsCurrentPage = ref(1);

const allReservations = computed(() => {
  let list = [];
  conciergeProperties.value.forEach(prop => {
    (prop.bookings || []).forEach(b => {
      if (!b.is_block) {
        list.push({ ...b, propertyTitle: prop.title, propertyId: prop.id });
      }
    });
  });

  if (reservationListFilter.value.property !== 'all') {
    list = list.filter(b => b.propertyId === parseInt(reservationListFilter.value.property));
  }
  if (reservationListFilter.value.platform !== 'all') {
    list = list.filter(b => (b.platform || 'resaoff') === reservationListFilter.value.platform);
  }
  if (reservationListFilter.value.year !== 'all') {
    const yr = parseInt(reservationListFilter.value.year);
    list = list.filter(b => new Date(b.start_date).getFullYear() === yr);
  }
  if (reservationListFilter.value.month !== 'all') {
    const mo = parseInt(reservationListFilter.value.month);
    list = list.filter(b => new Date(b.start_date).getMonth() === mo);
  }
  if (reservationListFilter.value.search.trim()) {
    const q = reservationListFilter.value.search.trim().toLowerCase();
    list = list.filter(b =>
      (b.guest_name || '').toLowerCase().includes(q) ||
      (b.propertyTitle || '').toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  return list;
});

const reservationsTotalPages = computed(() => {
  return Math.ceil(allReservations.value.length / reservationsPerPage.value) || 1;
});

const paginatedReservations = computed(() => {
  const start = (reservationsCurrentPage.value - 1) * reservationsPerPage.value;
  const end = start + reservationsPerPage.value;
  return allReservations.value.slice(start, end);
});

watch([reservationListFilter, reservationsPerPage], () => {
  reservationsCurrentPage.value = 1;
}, { deep: true });

// Available years derived from all bookings
const availableYears = computed(() => {
  const years = new Set();
  conciergeProperties.value.forEach(prop => {
    (prop.bookings || []).forEach(b => {
      if (!b.is_block && b.start_date) years.add(new Date(b.start_date).getFullYear());
    });
  });
  return Array.from(years).sort((a, b) => b - a);
});


// 3. Research State & Filters
const researchCurrentPage = ref(1);
const researchItemsPerPage = ref(10);
const editingResearchId = ref(null);
const showResearchFilterModal = ref(false);
const researchSearchQuery = ref("");
const researchFilters = ref({
  minPrice: null,
  maxPrice: null,
  minArea: null,
  maxArea: null,
  minPricePerSqm: null,
  maxPricePerSqm: null,
  minRooms: null,
  maxRooms: null,
  buyerIds: [],
  tagIds: [],
  startDate: null,
  endDate: null,
});
const researchSortKey = ref("created_at");
const researchSortOrder = ref("desc");
const researchSubTab = ref("apartment_sale");
const researchTypeTabs = [
  { value: "apartment_sale", label: "Apartments (For Sale)" },
  { value: "apartment_rent", label: "Apartments (For Rent)" },
  { value: "hotel", label: "Hotels" },
  { value: "building", label: "Building" },
];
const isApartmentResearchType = computed(() =>
  ["apartment_sale", "apartment_rent"].includes(newResearch.value.property_type),
);
const unreadMessagesCount = computed(
  () => contactMessages.value.filter((m) => !m.is_read).length,
);

const filteredResearchListings = computed(() => {
  const activeType = researchSubTab.value;

  let result = [...researchListings.value].filter((item) => {
    const matchesPropertyType =
      (item.property_type || "apartment_sale") === activeType;

    // Search Filter
    const matchesSearch =
      !researchSearchQuery.value ||
      item.neighborhood
        ?.toLowerCase()
        ?.includes(researchSearchQuery.value.toLowerCase()) ||
      item.address
        ?.toLowerCase()
        ?.includes(researchSearchQuery.value.toLowerCase()) ||
      item.zip_code?.includes(researchSearchQuery.value) ||
      item.url?.toLowerCase()?.includes(researchSearchQuery.value.toLowerCase());

    // Price Range Filter
    const matchesMinPrice =
      !researchFilters.value.minPrice ||
      item.price >= researchFilters.value.minPrice;
    const matchesMaxPrice =
      !researchFilters.value.maxPrice ||
      item.price <= researchFilters.value.maxPrice;

    // Area (m2) Range Filter
    const matchesMinArea =
      !researchFilters.value.minArea ||
      item.square_meters >= researchFilters.value.minArea;
    const matchesMaxArea =
      !researchFilters.value.maxArea ||
      item.square_meters <= researchFilters.value.maxArea;

    // Price per m2 Range Filter
    const matchesMinPricePerSqm =
      !researchFilters.value.minPricePerSqm ||
      (item.price_per_sqm &&
        item.price_per_sqm >= researchFilters.value.minPricePerSqm);
    const matchesMaxPricePerSqm =
      !researchFilters.value.maxPricePerSqm ||
      (item.price_per_sqm &&
        item.price_per_sqm <= researchFilters.value.maxPricePerSqm);

    // Rooms Range Filter
    const matchesMinRooms =
      !researchFilters.value.minRooms ||
      item.rooms >= researchFilters.value.minRooms;
    const matchesMaxRooms =
      !researchFilters.value.maxRooms ||
      item.rooms <= researchFilters.value.maxRooms;

    // Multiple Buyers Filter
    const matchesBuyers =
      researchFilters.value.buyerIds.length === 0 ||
      researchFilters.value.buyerIds.includes(item.buyer_id);

    // Multiple Tags Filter
    const matchesTags =
      researchFilters.value.tagIds.length === 0 ||
      (item.tags &&
        item.tags.some((t) => researchFilters.value.tagIds.includes(t.id)));

    // Date Range Filter
    const matchesDate = (() => {
      if (!researchFilters.value.startDate && !researchFilters.value.endDate)
        return true;
      const itemDate = new Date(item.created_at);
      if (researchFilters.value.startDate) {
        const start = new Date(researchFilters.value.startDate);
        start.setHours(0, 0, 0, 0);
        if (itemDate < start) return false;
      }
      if (researchFilters.value.endDate) {
        const end = new Date(researchFilters.value.endDate);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) return false;
      }
      return true;
    })();

    return (
      matchesPropertyType &&
      matchesSearch &&
      matchesMinPrice &&
      matchesMaxPrice &&
      matchesMinArea &&
      matchesMaxArea &&
      matchesMinPricePerSqm &&
      matchesMaxPricePerSqm &&
      matchesMinRooms &&
      matchesMaxRooms &&
      matchesBuyers &&
      matchesTags &&
      matchesDate
    );

  });

  // Sorting
  result.sort((a, b) => {
    let valA = a[researchSortKey.value];
    let valB = b[researchSortKey.value];

    // Handle special cases
    if (researchSortKey.value === "created_at") {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    }

    if (valA < valB) return researchSortOrder.value === "asc" ? -1 : 1;
    if (valA > valB) return researchSortOrder.value === "asc" ? 1 : -1;
    return 0;
  });

  return result;
});

const researchTotalPages = computed(() => {
  return Math.ceil(filteredResearchListings.value.length / researchItemsPerPage.value);
});

const paginatedResearchListings = computed(() => {
  const start = (researchCurrentPage.value - 1) * researchItemsPerPage.value;
  const end = start + researchItemsPerPage.value;
  return filteredResearchListings.value.slice(start, end);
});

// Reset pagination when search or filters change
watch([researchSearchQuery, researchFilters, researchItemsPerPage, researchSubTab], () => {
  researchCurrentPage.value = 1;
}, { deep: true });

const toggleResearchSort = (key) => {
  if (researchSortKey.value === key) {
    researchSortOrder.value =
      researchSortOrder.value === "asc" ? "desc" : "asc";
  } else {
    researchSortKey.value = key;
    researchSortOrder.value = "asc";
  }
};

const exportToExcel = () => {
  const data = filteredResearchListings.value.map((item) => ({
    Neighborhood: item.neighborhood,
    "Price (€)": item.price,
    "Area (m²)": item.square_meters,
    "Price per m² (€)": item.price_per_sqm,
    Rooms: item.rooms,
    Address: item.address || "-",
    DPE: item.dpe || "-",

    Balcony: item.has_balcony ? "Yes" : "No",
    Parking: item.has_parking ? "Yes" : "No",
    Garden: item.has_garden ? "Yes" : "No",
    Elevator: item.has_elevator ? "Yes" : "No",
    Floor: item.floor || "-",
    "Total Floors": item.total_floors || "-",
    Heating: item.heating_system || "-",

    URL: item.url,
    "Internal Notes": item.internal_notes || "-",
    "Date Added": new Date(item.created_at).toLocaleDateString(),
    "Added By": item.created_by?.full_name || item.created_by?.email || "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Research Listings");

  // Create filename with date
  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(workbook, `Doorman_Research_Export_${dateStr}.xlsx`);
};

const isLoading = ref(true);
const activeTab = ref("properties"); // properties, blogs, users, messages



const resetResearchFilters = () => {
  researchSearchQuery.value = "";
  researchFilters.value = {
    minPrice: null,
    maxPrice: null,
    minArea: null,
    maxArea: null,
    minPricePerSqm: null,
    maxPricePerSqm: null,
    minRooms: null,
    maxRooms: null,
    buyerIds: [],
    tagIds: [],
    startDate: null,
    endDate: null,
  };
};


const tags = ref([]);
const newTagName = ref("");
const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

const transportOptions = [
  "Metro 1",
  "Metro 2",
  "Metro 3",
  "Metro 4",
  "Metro 5",
  "Metro 6",
  "Metro 7",
  "Metro 8",
  "Metro 9",
  "Metro 10",
  "Metro 11",
  "Metro 12",
  "Metro 13",
  "Metro 14",
  "RER A",
  "RER B",
  "RER C",
  "RER D",
  "RER E",
  "Train L",
  "Train V",
  "Train H",
  "Train N",
  "Train P",
  "Train J",
  "Train R",
  "Train U",
  "Train K",
  "Tram",
];

const toolbarOptions = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ color: [] }, { background: [] }],
  ["link", "image", "clean"],
];


const canManagePost = (post) => {
  if (isSuperuser.value) return true;
  return post.author && post.author.email === userEmail.value;
};

const descriptionTab = ref("en");
const showTransportMenu = ref(false);

const toggleTransport = (opt) => {
  const index = newProperty.value.details.transport_info.indexOf(opt);
  if (index > -1) {
    newProperty.value.details.transport_info.splice(index, 1);
  } else {
    newProperty.value.details.transport_info.push(opt);
  }
};

const newProperty = ref({
  title: "",
  price: 0,
  listing_type: "buy",
  status: "active",
  details: {
    description: "",
    description_en: "",
    description_fr: "",
    description_tr: "",
    bedrooms: 0,
    bathrooms: 0,
    sqft: 0,
    address: "",
    neighborhood: "",
    property_type: "Apartment",
    energy_class: "A",
    has_parking: false,
    has_balcony: false,
    has_cave: false,
    has_elevator: false,
    floor: null,
    total_floors: null,
    available_date: "",
    transport_info: [],
    lat: null,
    lng: null,
  },
  media: [],
});

const newUser = ref({
  email: "",
  full_name: "",
  role: "editor",
});
const passwordResets = ref([]);

const newBlogPost = ref({
  slug: "",
  title_en: "",
  title_fr: "",
  title_tr: "",
  content_en: "",
  content_fr: "",
  content_tr: "",
  excerpt_en: "",
  excerpt_fr: "",
  excerpt_tr: "",
  image_url: "",
  is_published: true,
});

const resetResearchForm = () => {
  newResearch.value = {
    url: "",
    rooms: 1,
    address: "",
    neighborhood: "",
    zip_code: "",
    buyer_id: null,
    dpe: "A",
    price: 0,
    square_meters: 0,
    has_balcony: false,
    has_parking: false,
    has_garden: false,
    has_elevator: false,
    floor: null,
    total_floors: null,
    heating_system: "Electric",
    internal_notes: "",
    tag_ids: [],
    property_type: "apartment_sale",
  };
  isEditingResearch.value = false;
  editingResearchId.value = null;
};

const newResearch = ref({
  url: "",
  rooms: 1,
  address: "",
  neighborhood: "",
  zip_code: "",
  buyer_id: null,
  dpe: "A",
  price: 0,
  square_meters: 0,
  has_balcony: false,
  has_parking: false,
  has_garden: false,
  has_elevator: false,
  floor: null,
  total_floors: null,
  heating_system: "Electric",
  internal_notes: "",
  tag_ids: [],
  property_type: "apartment_sale",
});

const newBuyer = ref({
  full_name: "",
  email: "",
  phone: "",
});

const profilePassword = ref({
  old_password: "",
  new_password: "",
  confirm_password: "",
});

const changeMyPassword = async () => {
  if (
    profilePassword.value.new_password !==
    profilePassword.value.confirm_password
  ) {
    alert("Passwords do not match!");
    return;
  }

  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        old_password: profilePassword.value.old_password,
        new_password: profilePassword.value.new_password,
      }),
    });

    if (res.ok) {
      alert("Password updated successfully!");
      profilePassword.value = {
        old_password: "",
        new_password: "",
        confirm_password: "",
      };
    } else {
      const errorData = await res.json();
      alert(`Error: ${errorData.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

// Auto-generate slug from English title
watch(
  () => newBlogPost.value.title_en,
  (newTitle) => {
    // Only auto-generate slug if we are NOT in edit mode
    // (To prevent breaking existing URLs if title is tweaked)
    // Or if the user prefers, always update. I'll stick to new posts for safety.
    if (!isEditingBlog.value) {
      newBlogPost.value.slug = newTitle
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "") // Remove non-word chars
        .replace(/[\s_-]+/g, "-") // Replace spaces/underscores with hyphens
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
    }
  },
);

const handleLogout = () => {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_role");
  router.push("/login");
};

const fetchProperties = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/properties/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleLogout();
    properties.value = await res.json();
  } catch (err) {
    console.error("Failed to fetch properties", err);
  } finally {
    isLoading.value = false;
  }
};

const fetchConciergeProperties = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/concierge/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleLogout();
    const data = await res.json();

    // Apply saved sorting order from LocalStorage
    const savedOrder = localStorage.getItem('concierge_properties_order');
    if (savedOrder) {
      const orderIds = JSON.parse(savedOrder);
      data.sort((a, b) => {
        const idxA = orderIds.indexOf(a.id);
        const idxB = orderIds.indexOf(b.id);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    }

    conciergeProperties.value = data;
    
    if (selectedConciergeProperty.value) {
      const updated = conciergeProperties.value.find(p => p.id === selectedConciergeProperty.value.id);
      if (updated) {
        selectedConciergeProperty.value = updated;
      }
    }
  } catch (err) {
    console.error("Failed to fetch concierge properties", err);
  }
};

const draggedPropertyId = ref(null);

const dragStart = (event, propertyId) => {
  draggedPropertyId.value = propertyId;
  event.dataTransfer.effectAllowed = "move";
};

const dropRow = (event, targetPropertyId) => {
  if (draggedPropertyId.value === null || draggedPropertyId.value === targetPropertyId) return;
  
  const list = [...conciergeProperties.value];
  const dragIndex = list.findIndex(p => p.id === draggedPropertyId.value);
  const dropIndex = list.findIndex(p => p.id === targetPropertyId);
  
  if (dragIndex !== -1 && dropIndex !== -1) {
    const [removed] = list.splice(dragIndex, 1);
    list.splice(dropIndex, 0, removed);
    
    conciergeProperties.value = list;
    
    const orderIds = list.map(p => p.id);
    localStorage.setItem('concierge_properties_order', JSON.stringify(orderIds));
  }
  
  draggedPropertyId.value = null;
};

const conciergeReports = ref([]);

const fetchConciergeReports = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/concierge/reports/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      conciergeReports.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch concierge reports", err);
  }
};

// ── Cleaning API Functions ─────────────────────────────────────────────────

const fetchCleaners = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/cleaners/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) cleaners.value = await res.json();
  } catch (err) { console.error("Failed to fetch cleaners", err); }
};

const fetchAllCleaningAssignments = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/cleaning-assignments/`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) allCleaningAssignments.value = await res.json();
  } catch (err) { console.error("Failed to fetch all cleaning assignments", err); }
};

const fetchCleaningAssignments = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const url = cleaningSelectedDate.value
      ? `${backendUrl}/cleaning-assignments/?cleaning_date=${cleaningSelectedDate.value}`
      : `${backendUrl}/cleaning-assignments/`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) cleaningAssignments.value = await res.json();
    
    // Auto-fetch all assignments for carry over tracking
    await fetchAllCleaningAssignments();
  } catch (err) { console.error("Failed to fetch cleaning assignments", err); }
};

const addCleaner = async () => {
  if (!newCleanerForm.value.name.trim()) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/cleaners/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: newCleanerForm.value.name.trim(),
        phone: null,
        hourly_rate: newCleanerForm.value.hourly_rate !== null && newCleanerForm.value.hourly_rate !== "" ? parseFloat(newCleanerForm.value.hourly_rate) : null
      })
    });
    if (res.ok) {
      newCleanerForm.value = { name: "", hourly_rate: null };
      await Promise.all([
        fetchCleaners(),
        fetchReportCleaningAssignments()
      ]);
    }
  } catch (err) { console.error("Failed to add cleaner", err); }
};

const deleteCleaner = async (cleanerId) => {
  if (!confirm("Are you sure you want to delete this cleaner?")) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/cleaners/${cleanerId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok || res.status === 204) {
      await Promise.all([
        fetchCleaners(),
        fetchReportCleaningAssignments()
      ]);
    }
  } catch (err) { console.error("Failed to delete cleaner", err); }
};

const startEditCleaner = (cleaner) => {
  isEditingCleaner.value = true;
  editingCleanerId.value = cleaner.id;
  newCleanerForm.value = {
    name: cleaner.name,
    hourly_rate: cleaner.hourly_rate
  };
};

const cancelEditCleaner = () => {
  isEditingCleaner.value = false;
  editingCleanerId.value = null;
  newCleanerForm.value = { name: "", hourly_rate: null };
};

const updateCleaner = async () => {
  if (!newCleanerForm.value.name.trim()) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/cleaners/${editingCleanerId.value}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: newCleanerForm.value.name.trim(),
        phone: null,
        hourly_rate: newCleanerForm.value.hourly_rate !== null && newCleanerForm.value.hourly_rate !== "" ? parseFloat(newCleanerForm.value.hourly_rate) : null
      })
    });
    if (res.ok) {
      cancelEditCleaner();
      await Promise.all([
        fetchCleaners(),
        fetchReportCleaningAssignments()
      ]);
    } else {
      alert("Failed to update cleaner.");
    }
  } catch (err) {
    console.error("Failed to update cleaner", err);
  }
};

const assignCleaner = async (propertyId, cleanerId, note) => {
  if (!cleanerId) { alert("Please select a cleaner."); return; }
  if (!propertyId) { alert("Please select a property."); return; }
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/cleaning-assignments/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        cleaner_id: parseInt(cleanerId),
        property_id: parseInt(propertyId),
        cleaning_date: cleaningSelectedDate.value,
        notes: note || null
      })
    });
    if (res.ok) {
      cleaningNote.value[propertyId] = "";
      await Promise.all([
        fetchCleaningAssignments(),
        fetchReportCleaningAssignments()
      ]);
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) { console.error("Failed to assign cleaner", err); }
};

const removeAssignment = async (assignmentId) => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/cleaning-assignments/${assignmentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok || res.status === 204) {
      await Promise.all([
        fetchCleaningAssignments(),
        fetchReportCleaningAssignments()
      ]);
    }
  } catch (err) { console.error("Failed to remove assignment", err); }
};

const deletePendingCleaning = (propertyId, dateStr) => {
  if (confirm("Are you sure you want to cancel/delete this unassigned cleaning?")) {
    const key = `${propertyId}-${dateStr}`;
    if (!deletedCleanings.value.includes(key)) {
      deletedCleanings.value.push(key);
      localStorage.setItem('deleted_cleanings', JSON.stringify(deletedCleanings.value));
    }
  }
};

// Properties that have a checkout on or before the selected cleaning date, and are not yet assigned/cleaned
const checkoutsOnSelectedDate = computed(() => {
  if (!cleaningSelectedDate.value) return [];
  const selectedDateStr = cleaningSelectedDate.value;
  
  const results = [];
  
  for (const prop of conciergeProperties.value) {
    if (!prop.bookings) continue;
    
    // Find all bookings for this property where checkout is <= selectedDateStr
    const candidateBookings = prop.bookings.filter(b => b.end_date && b.end_date <= selectedDateStr);
    
    for (const booking of candidateBookings) {
      const checkoutDate = booking.end_date;
      
      // 1. Check if manually deleted/cancelled by user
      const key = `${prop.id}-${checkoutDate}`;
      if (deletedCleanings.value.includes(key)) continue;
      
      // 2. Check if this property was assigned to any cleaner on or after this checkout date (up to the selected date)
      // Note: we check if there is an assignment on a day BEFORE selectedDateStr
      const assignedBeforeToday = allCleaningAssignments.value.some(a => 
        a.property_id === prop.id && 
        a.cleaning_date >= checkoutDate && 
        a.cleaning_date < selectedDateStr
      );
      
      if (assignedBeforeToday) continue;
      
      // Link with today's assignment if it exists (so it shows under the cleaner's list today)
      const todayAssignment = cleaningAssignments.value.find(a => a.property_id === prop.id);
      
      results.push({
        prop,
        booking,
        assignment: todayAssignment || null
      });
    }
  }
  
  return results;
});

const unassignedCheckouts = computed(() => {
  return checkoutsOnSelectedDate.value.filter(item => !item.assignment);
});

const getAssignmentsForCleaner = (cleanerId) => {
  if (!cleaningAssignments.value) return [];
  return cleaningAssignments.value.filter(a => a.cleaner_id === cleanerId);
};

const cleaningWhatsappMessage = computed(() => {
  if (!cleaningSelectedDate.value) return "";
  
  // Parse date safely avoiding timezone shift
  const parts = cleaningSelectedDate.value.split('-');
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  
  const dayNum = dateObj.getDate();
  const monthName = dateObj.toLocaleDateString('fr-FR', { month: 'long' }).toUpperCase();
  const yearNum = dateObj.getFullYear();
  let weekdayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'long' });
  if (weekdayName) {
    weekdayName = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);
  }
  
  let msg = "PLANNING DE MENAGE\n";
  msg += `${dayNum} ${monthName} ${yearNum} ${weekdayName}\n`;
  
  // Group assignments by cleaner name
  const cleanerGroups = {};
  
  checkoutsOnSelectedDate.value.forEach(item => {
    if (item.assignment) {
      const cleanerName = item.assignment.cleaner?.name || "Unassigned";
      if (!cleanerGroups[cleanerName]) {
        cleanerGroups[cleanerName] = [];
      }
      const note = item.assignment.notes ? `: ${item.assignment.notes}` : "";
      cleanerGroups[cleanerName].push(`- ${item.prop.title}${note}`);
    } else {
      const unassignedKey = "Unassigned Cleanings";
      if (!cleanerGroups[unassignedKey]) {
        cleanerGroups[unassignedKey] = [];
      }
      cleanerGroups[unassignedKey].push(`- ${item.prop.title}: Pending Assignment`);
    }
  });
  
  Object.keys(cleanerGroups).forEach(cleanerName => {
    msg += `\n*${cleanerName}*:\n`;
    cleanerGroups[cleanerName].forEach(line => {
      msg += `${line}\n`;
    });
  });
  
  return msg;
});


const copyCleaningSchedule = async () => {
  const msg = cleaningWhatsappMessage.value;
  if (!msg.trim()) {
    alert("The cleaning schedule is empty.");
    return;
  }
  try {
    await navigator.clipboard.writeText(msg);
    alert("WhatsApp message copied to clipboard successfully!");
  } catch (err) {
    console.error("Failed to copy", err);
    alert("Failed to copy, please check browser permissions.");
  }
};



// watch date change to reload assignments
const addConciergeProperty = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/concierge/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newConcierge.value),
    });
    if (res.ok) {
      await fetchConciergeProperties();
      alert("Concierge property added!");
      resetConciergeForm();
      showConciergeForm.value = false;
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const updateConciergeProperty = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/concierge/${editingConciergeId.value}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newConcierge.value),
    });
    if (res.ok) {
      await fetchConciergeProperties();
      if (selectedConciergeDetailsProperty.value && selectedConciergeDetailsProperty.value.id === editingConciergeId.value) {
        selectedConciergeDetailsProperty.value = conciergeProperties.value.find(p => p.id === editingConciergeId.value);
      }
      alert("Concierge property updated!");
      cancelEditConcierge();
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const deleteConciergeProperty = async (id) => {
  if (!confirm("Are you sure? This will delete all associated bookings.")) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/concierge/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      if (selectedConciergeProperty.value && selectedConciergeProperty.value.id === id) {
        selectedConciergeProperty.value = null;
      }
      await fetchConciergeProperties();
      alert("Concierge property deleted!");
    } else {
      alert("Failed to delete property.");
    }
  } catch (err) {
    alert("Network error.");
  }
};

const startAddConcierge = () => {
  isEditingConcierge.value = false;
  editingConciergeId.value = null;
  resetConciergeForm();
  showConciergeForm.value = true;
};

const startEditConcierge = (prop) => {
  isEditingConcierge.value = true;
  editingConciergeId.value = prop.id;
  newConcierge.value = {
    title: prop.title,
    address: prop.address || "",
    owner_name: prop.owner_name || "",
    owner_email: prop.owner_email || "",
    airbnb_cleaning_fee: prop.airbnb_cleaning_fee ?? null,
    max_cleaning_duration: prop.max_cleaning_duration ?? null
  };
  showConciergeForm.value = true;
};

const cancelEditConcierge = () => {
  isEditingConcierge.value = false;
  editingConciergeId.value = null;
  showConciergeForm.value = false;
  resetConciergeForm();
};

const daysInActiveMonth = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;
  const numDays = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let d = 1; d <= numDays; d++) {
    days.push(new Date(year, month, d));
  }
  return days;
});

const parseISODateLocal = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateStr);
};

const isToday = (dateObj) => {
  const today = new Date();
  return dateObj.getDate() === today.getDate() &&
         dateObj.getMonth() === today.getMonth() &&
         dateObj.getFullYear() === today.getFullYear();
};

const scrollToToday = async () => {
  const today = new Date();
  currentYear.value = today.getFullYear();
  currentMonth.value = today.getMonth();
  // Wait for Vue to re-render with the correct month
  await nextTick();
  const todayStr = today.toISOString().slice(0, 10);
  const todayEl = document.querySelector(`[data-date="${todayStr}"]`);
  if (todayEl) {
    todayEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
};

const getBookingState = (property, dateObj) => {
  const matches = getBookingsForDay(property, dateObj);
  if (matches.length > 0) {
    return {
      isBooked: true,
      booking: matches[0].booking,
      isStart: matches[0].isStart,
      isEnd: matches[0].isEnd
    };
  }
  return { isBooked: false };
};

const getBookingsForDay = (property, dateObj) => {
  if (!property.bookings) return [];
  
  const curStr = formatDateToISO(dateObj);
  const cur = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  
  const matches = [];
  
  for (const b of property.bookings) {
    const s = parseISODateLocal(b.start_date);
    const e = parseISODateLocal(b.end_date);
    
    if (cur >= s && cur <= e) {
      const isStart = formatDateToISO(s) === curStr;
      const isEnd = formatDateToISO(e) === curStr;
      
      matches.push({
        booking: b,
        isStart,
        isEnd
      });
    }
  }
  
  // Sort: checkout (isEnd) first, checkin (isStart) second
  matches.sort((a, b) => {
    if (a.isEnd && !b.isEnd) return -1;
    if (!a.isEnd && b.isEnd) return 1;
    return 0;
  });
  
  return matches;
};

const getBookingBarStyle = (booking, isStart, isEnd, dayBookings = []) => {
  let bg = '#f97316'; // default manual orange
  let color = '#000000'; // black text
  
  const platform = (booking.platform || '').toLowerCase();
  
  if (platform === 'airbnb') {
    bg = '#ef4444'; // red
    color = '#ffffff';
  } else if (platform === 'booking') {
    bg = '#2563eb'; // vibrant blue
    color = '#ffffff';
  }
  
  if (booking.is_block) {
    bg = '#64748b'; // slate gray for blocks
    color = '#ffffff';
  }
  
  // night-based PMS calendar logic:
  // - check-in day (isStart): right 50% (since check-in is in afternoon)
  // - check-out day (isEnd): left 50% (since check-out is in morning)
  // - middle day: 100%
  
  if (isStart && isEnd) {
    // Single day booking (starts and ends same day, rare)
    return {
      background: bg,
      color: color,
      width: '100%',
      left: '0',
      right: '0',
      borderTopLeftRadius: '18px',
      borderBottomLeftRadius: '18px',
      borderTopRightRadius: '18px',
      borderBottomRightRadius: '18px',
      zIndex: 3,
      overflow: 'visible'
    };
  }
  
  if (isStart) {
    // Check-in day: right 50% of the cell
    return {
      background: bg,
      color: color,
      width: '50%',
      left: 'auto',
      right: '0',
      borderTopLeftRadius: '18px',
      borderBottomLeftRadius: '18px',
      borderTopRightRadius: '0',
      borderBottomRightRadius: '0',
      zIndex: 3,
      overflow: 'visible'
    };
  }
  
  if (isEnd) {
    // Check-out day: left 50% of the cell
    return {
      background: bg,
      color: color,
      width: '50%',
      left: '0',
      right: 'auto',
      borderTopLeftRadius: '0',
      borderBottomLeftRadius: '0',
      borderTopRightRadius: '18px',
      borderBottomRightRadius: '18px',
      zIndex: 2,
      overflow: 'hidden'
    };
  }
  
  // Middle day: 100% cell width
  return {
    background: bg,
    color: color,
    width: '100%',
    left: '0',
    right: '0',
    borderTopLeftRadius: '0',
    borderBottomLeftRadius: '0',
    borderTopRightRadius: '0',
    borderBottomRightRadius: '0',
    zIndex: 2,
    overflow: 'hidden'
  };
};

const resetConciergeForm = () => {
  newConcierge.value = { title: "", address: "", owner_name: "", owner_email: "" };
};

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const calendarDays = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;
  
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const days = [];
  
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    days.push({
      dayNumber: d,
      date: new Date(prevYear, prevMonth, d),
      isCurrentMonth: false,
    });
  }
  
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      dayNumber: d,
      date: new Date(year, month, d),
      isCurrentMonth: true,
    });
  }
  
  const totalSlots = 42;
  const nextMonthPadding = totalSlots - days.length;
  for (let d = 1; d <= nextMonthPadding; d++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    days.push({
      dayNumber: d,
      date: new Date(nextYear, nextMonth, d),
      isCurrentMonth: false,
    });
  }
  
  return days.map(day => {
    const dateStr = formatDateToISO(day.date);
    const dayBookings = [];
    
    if (selectedConciergeProperty.value) {
      dayBookings.push(...findBookingsForDate(selectedConciergeProperty.value, day.date));
    } else {
      conciergeProperties.value.forEach(prop => {
        const bookings = findBookingsForDate(prop, day.date).map(b => ({
          ...b,
          propertyName: prop.title
        }));
        dayBookings.push(...bookings);
      });
    }
    
    return {
      ...day,
      dateStr,
      bookings: dayBookings,
      isBooked: dayBookings.length > 0
    };
  });
});

const formatDateToISO = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateToEU = (dateVal) => {
  if (!dateVal) return "—";
  if (typeof dateVal === 'string') {
    const parts = dateVal.split('-');
    if (parts.length === 3) {
      const yy = parts[0].slice(2);
      return `${parts[2]}/${parts[1]}/${yy}`;
    }
  } else if (dateVal instanceof Date) {
    const day = String(dateVal.getDate()).padStart(2, '0');
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const yy = String(dateVal.getFullYear()).slice(2);
    return `${day}/${month}/${yy}`;
  }
  return dateVal;
};

const exportReservationsToExcel = (bookings, propertyTitle = null) => {
  const reportBookings = (bookings || []).filter(b => !b.is_block);
  const rows = [];
  
  // Title / Branding Header
  rows.push(["DOORMAN CONCIERGE SERVICES"]);
  if (propertyTitle) {
    rows.push([`Reservations Report for: ${propertyTitle}`]);
  } else {
    rows.push(["All Reservations Report"]);
  }
  rows.push([`Generated on: ${new Date().toLocaleDateString()}`]);
  rows.push([]); // blank row
  
  // Table Headers
  rows.push([
    "Property",
    "Guest Name",
    "Platform",
    "Check-in",
    "Check-out",
    "Nights",
    "Gross Revenue (€)",
    "Doorman Commission (€)",
    "Owner Payout (€)"
  ]);
  
  // Data rows
  reportBookings.forEach(b => {
    rows.push([
      b.propertyTitle || propertyTitle || "—",
      b.guest_name || b.summary || "—",
      b.platform ? (b.platform.charAt(0).toUpperCase() + b.platform.slice(1)) : "Resaoff",
      formatDateToEU(b.start_date),
      formatDateToEU(b.end_date),
      b.nights || 0,
      b.price ? parseFloat(b.price) : 0,
      b.doorman_commission ? parseFloat(b.doorman_commission) : 0,
      b.owner_payout ? parseFloat(b.owner_payout) : 0
    ]);
  });
  
  // Blank row
  rows.push([]);
  
  // Totals Row
  const totalGross = reportBookings.reduce((sum, b) => sum + parseFloat(b.price || 0), 0);
  const totalDoorman = reportBookings.reduce((sum, b) => sum + parseFloat(b.doorman_commission || 0), 0);
  const totalOwner = reportBookings.reduce((sum, b) => sum + parseFloat(b.owner_payout || 0), 0);
  const totalNights = reportBookings.reduce((sum, b) => sum + (b.nights || 0), 0);
  
  rows.push([
    "TOTALS",
    "",
    "",
    "",
    "",
    totalNights,
    totalGross,
    totalDoorman,
    totalOwner
  ]);
  
  // Create workbook and sheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Merge title cells
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, // merge row 0 col 0-8
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }, // merge row 1 col 0-8
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } }  // merge row 2 col 0-8
  ];
  
  // Adjust column widths
  const max_lens = [22, 22, 14, 14, 14, 10, 18, 22, 18];
  ws['!cols'] = max_lens.map(w => ({ wch: w }));
  
  XLSX.utils.book_append_sheet(wb, ws, "Reservations");
  
  // Save file
  const filename = propertyTitle 
    ? `doorman_report_${propertyTitle.replace(/\s+/g, '_').toLowerCase()}.xlsx`
    : `doorman_report_all.xlsx`;
  XLSX.writeFile(wb, filename);
};

const isSendingEmail = ref(false);

const sendOwnerReportEmail = async () => {
  const prop = selectedConciergeDetailsProperty.value;
  if (!prop) return;
  if (!prop.owner_email) {
    alert("Owner email address is not configured for this property. Please edit the property and specify an email address first.");
    return;
  }
  
  let periodText = "All Time";
  let queryParams = "";
  
  if (emailReportPeriod.value.type === 'selected') {
    const year = currentYear.value;
    const month = currentMonth.value;
    const sDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const eDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    queryParams = `?start_date=${sDate}&end_date=${eDate}`;
    periodText = `${monthNames[month]} ${year}`;
  } else if (emailReportPeriod.value.type === 'custom') {
    const year = emailReportPeriod.value.year;
    const month = emailReportPeriod.value.month;
    const sDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const eDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    queryParams = `?start_date=${sDate}&end_date=${eDate}`;
    periodText = `${monthNames[month]} ${year}`;
  }
  
  if (!confirm(`Are you sure you want to send the Excel report (${periodText}) to the owner (${prop.owner_name || 'Owner'} - ${prop.owner_email})?`)) {
    return;
  }
  
  const token = localStorage.getItem("admin_token");
  isSendingEmail.value = true;
  
  const url = `${backendUrl}/concierge/${prop.id}/send-report-email${queryParams}`;
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (res.ok) {
      alert(`Excel report for ${periodText} has been sent successfully to the property owner's email address!`);
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to send email. Network error.");
  } finally {
    isSendingEmail.value = false;
  }
};

const conciergeReportTrackingRows = computed(() => {
  const rows = [];
  
  for (const prop of conciergeProperties.value) {
    if (!prop.bookings) continue;
    
    const periods = new Set();
    
    for (const b of prop.bookings) {
      if (b.is_block || !b.start_date) continue;
      const s = parseISODateLocal(b.start_date);
      const year = s.getFullYear();
      const month = s.getMonth();
      periods.add(`${year}-${month}`);
    }
    
    const sortedPeriods = Array.from(periods).sort((a, b) => {
      const [yA, mA] = a.split('-').map(Number);
      const [yB, mB] = b.split('-').map(Number);
      return yB !== yA ? yB - yA : mB - mA;
    });
    
    for (const pStr of sortedPeriods) {
      const [year, month] = pStr.split('-').map(Number);
      
      const match = conciergeReports.value.find(
        r => r.property_id === prop.id && r.year === year && r.month === month
      );
      
      rows.push({
        id: `${prop.id}-${year}-${month}`,
        propertyId: prop.id,
        propertyTitle: prop.title,
        ownerName: prop.owner_name || "—",
        ownerEmail: prop.owner_email || "—",
        year,
        month,
        monthName: monthNames[month],
        status: match ? match.status : "not_sent",
        lastSentAt: match ? match.last_sent_at : null
      });
    }
  }
  
  return rows;
});

const sendTrackingReportEmail = async (row) => {
  if (!row.ownerEmail || row.ownerEmail === "—") {
    alert("Owner email address is not configured for this property. Please edit the property first.");
    return;
  }
  
  const periodText = `${row.monthName} ${row.year}`;
  if (!confirm(`Are you sure you want to send the Excel report (${periodText}) to the owner (${row.ownerName} - ${row.ownerEmail})?`)) {
    return;
  }
  
  const token = localStorage.getItem("admin_token");
  isSendingEmail.value = true;
  
  const url = `${backendUrl}/concierge/${row.propertyId}/send-report-email?year=${row.year}&month=${row.month}`;
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (res.ok) {
      alert(`Excel report for ${periodText} has been sent successfully to the property owner's email address!`);
      await fetchConciergeReports();
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to send email. Network error.");
  } finally {
    isSendingEmail.value = false;
  }
};

const filteredReportTrackingRows = computed(() => {
  let list = conciergeReportTrackingRows.value || [];
  
  // Filter by selected year and month
  list = list.filter(row => row.year === reportsFilter.value.year && row.month === (reportsFilter.value.month - 1));
  
  const s = reportsFilter.value.search.trim().toLowerCase();
  if (s) {
    list = list.filter(row => 
      row.propertyTitle.toLowerCase().includes(s) || 
      row.ownerName.toLowerCase().includes(s) ||
      row.ownerEmail.toLowerCase().includes(s)
    );
  }
  
  const stat = reportsFilter.value.status;
  if (stat !== 'all') {
    list = list.filter(row => row.status === stat);
  }
  
  return list;
});

const reportsTotalPages = computed(() => {
  return Math.ceil(filteredReportTrackingRows.value.length / reportsPerPage.value) || 1;
});

const paginatedReportTrackingRows = computed(() => {
  const start = (reportsCurrentPage.value - 1) * reportsPerPage.value;
  const end = start + reportsPerPage.value;
  return filteredReportTrackingRows.value.slice(start, end);
});

watch([reportsFilter, reportsPerPage], () => {
  reportsCurrentPage.value = 1;
}, { deep: true });

const findBookingsForDate = (property, dateObj) => {
  if (!property.bookings) return [];
  
  return property.bookings.filter(booking => {
    const cur = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const s = parseISODateLocal(booking.start_date);
    const e = parseISODateLocal(booking.end_date);
    return cur >= s && cur <= e;
  });
};

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
};

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
};

const openPropertyDetails = (prop) => {
  selectedConciergeDetailsProperty.value = prop;
  propertyDetailsFilterYear.value = new Date().getFullYear();
  propertyDetailsFilterMonth.value = new Date().getMonth() + 1;
  showConciergeDetailsModal.value = true;
};

const filteredPropertyDetailsBookings = computed(() => {
  if (!selectedConciergeDetailsProperty.value || !selectedConciergeDetailsProperty.value.bookings) {
    return [];
  }
  const year = propertyDetailsFilterYear.value;
  const month = propertyDetailsFilterMonth.value;

  const list = selectedConciergeDetailsProperty.value.bookings.filter(b => {
    if (b.is_block || !b.start_date) return false;
    const d = parseISODateLocal(b.start_date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  return list.sort((a, b) => parseISODateLocal(a.start_date) - parseISODateLocal(b.start_date));
});

const filteredConciergePropertyBookings = computed(() => {
  if (!selectedConciergeDetailsProperty.value || !selectedConciergeDetailsProperty.value.bookings) {
    return [];
  }
  
  let year = currentYear.value;
  let month = currentMonth.value; // 0-11
  const filterType = emailReportPeriod.value.type;

  if (filterType === 'custom') {
    year = parseInt(emailReportPeriod.value.year);
    month = parseInt(emailReportPeriod.value.month); // 0-11
  } else if (filterType === 'all') {
    return selectedConciergeDetailsProperty.value.bookings.filter(b => !b.is_block).sort(
      (a, b) => parseISODateLocal(a.start_date) - parseISODateLocal(b.start_date)
    );
  }
  
  const list = selectedConciergeDetailsProperty.value.bookings.filter(b => {
    if (b.is_block || !b.start_date || !b.end_date) return false;
    const start = parseISODateLocal(b.start_date);
    const end = parseISODateLocal(b.end_date);
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59);
    return start <= lastDay && end >= firstDay;
  });

  return list.sort((a, b) => parseISODateLocal(a.start_date) - parseISODateLocal(b.start_date));
});

const dashboardYears = computed(() => {
  const years = new Set([new Date().getFullYear()]);
  conciergeProperties.value.forEach(prop => {
    (prop.bookings || []).forEach(b => {
      if (b.start_date) {
        years.add(new Date(b.start_date).getFullYear());
      }
    });
  });
  return Array.from(years).sort((a, b) => b - a);
});

const dashboardStats = computed(() => {
  const year = parseInt(dashboardYear.value);
  const propId = dashboardPropertyId.value;
  
  const targetProps = propId === 'all' 
    ? conciergeProperties.value 
    : conciergeProperties.value.filter(p => p.id === parseInt(propId));
    
  const months = Array.from({ length: 12 }, (_, idx) => {
    return {
      monthIdx: idx,
      monthName: new Date(year, idx, 1).toLocaleString('en-US', { month: 'short' }),
      totalDays: 0,
      occupiedDays: 0,
      blockedDays: 0,
      grossRevenue: 0,
      doormanEarnings: 0,
      bookingsCount: 0,
      occupancyRate: 0
    };
  });
  
  targetProps.forEach(prop => {
    for (let m = 0; m < 12; m++) {
      const lastDayOfMonth = new Date(year, m + 1, 0);
      const daysInMonth = lastDayOfMonth.getDate();
      
      months[m].totalDays += daysInMonth;
      
      const bookings = prop.bookings || [];
      const occupiedSet = new Set();
      const blockedSet = new Set();
      
      bookings.forEach(b => {
        if (!b.start_date || !b.end_date) return;
        const bStart = parseISODateLocal(b.start_date);
        const bEnd = parseISODateLocal(b.end_date);
        
        const temp = new Date(bStart);
        while (temp < bEnd) {
          if (temp.getFullYear() === year && temp.getMonth() === m) {
            const dateNum = temp.getDate();
            if (b.is_block) {
              blockedSet.add(dateNum);
            } else {
              occupiedSet.add(dateNum);
            }
          }
          temp.setDate(temp.getDate() + 1);
        }
        
        if (bStart.getFullYear() === year && bStart.getMonth() === m && !b.is_block) {
          months[m].grossRevenue += parseFloat(b.price || 0);
          months[m].doormanEarnings += parseFloat(b.doorman_commission || 0);
          months[m].bookingsCount++;
        }
      });
      
      months[m].occupiedDays += occupiedSet.size;
      months[m].blockedDays += blockedSet.size;
    }
  });
  
  let totalGross = 0;
  let totalDoorman = 0;
  let totalOccupied = 0;
  let totalBlocked = 0;
  let totalRentableDays = 0;
  let totalBookings = 0;
  
  months.forEach(m => {
    const rentableDays = m.totalDays - m.blockedDays;
    m.occupancyRate = rentableDays > 0 ? (m.occupiedDays / rentableDays) * 100 : 0;
    if (m.occupancyRate > 100) m.occupancyRate = 100;
    
    totalGross += m.grossRevenue;
    totalDoorman += m.doormanEarnings;
    totalOccupied += m.occupiedDays;
    totalBlocked += m.blockedDays;
    totalRentableDays += Math.max(0, rentableDays);
    totalBookings += m.bookingsCount;
  });
  
  const avgOccupancy = totalRentableDays > 0 ? (totalOccupied / totalRentableDays) * 100 : 0;
  
  return {
    months,
    totalGross,
    totalDoorman,
    totalOccupied,
    totalBlocked,
    totalBookings,
    avgOccupancy: avgOccupancy > 100 ? 100 : avgOccupancy
  };
});

const openBookingModal = (prop, startDate = "", endDate = "") => {
  selectedBookingProperty.value = prop;
  newBooking.value = {
    start_date: startDate,
    end_date: endDate,
    guest_name: "",
    price: null,
    notes: ""
  };
  showBookingModal.value = true;
};

const addManualBooking = async () => {
  const token = localStorage.getItem("admin_token");
  const propId = selectedBookingProperty.value.id;
  try {
    const res = await fetch(`${backendUrl}/concierge/${propId}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newBooking.value),
    });
    if (res.ok) {
      await fetchConciergeProperties();
      alert("Reservation added successfully!");
      showBookingModal.value = false;
      
      if (selectedConciergeDetailsProperty.value && selectedConciergeDetailsProperty.value.id === propId) {
        selectedConciergeDetailsProperty.value = conciergeProperties.value.find(p => p.id === propId);
      }
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const deleteManualBooking = async (bookingId) => {
  if (!confirm("Are you sure you want to cancel this reservation?")) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/concierge/bookings/${bookingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchConciergeProperties();
      alert("Reservation canceled successfully!");
      showBookingDetailsModal.value = false;
      
      if (selectedConciergeDetailsProperty.value) {
        const propId = selectedConciergeDetailsProperty.value.id;
        selectedConciergeDetailsProperty.value = conciergeProperties.value.find(p => p.id === propId);
      }
    } else {
      alert("Failed to cancel reservation.");
    }
  } catch (err) {
    alert("Network error.");
  }
};

const updateBookingDetails = async () => {
  const token = localStorage.getItem("admin_token");
  const bId = selectedBookingDetail.value.id;
  try {
    const res = await fetch(`${backendUrl}/concierge/bookings/${bId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        guest_name: selectedBookingDetail.value.guest_name,
        price: selectedBookingDetail.value.price,
        platform: selectedBookingDetail.value.platform || "resaoff",
        platform_fee: selectedBookingDetail.value.platform_fee || 0,
        commission_rate: selectedBookingDetail.value.commission_rate || 20,
        notes: selectedBookingDetail.value.notes
      }),
    });
    if (res.ok) {
      await fetchConciergeProperties();
      alert("Reservation details updated successfully!");
      showBookingDetailsModal.value = false;
      
      if (selectedConciergeDetailsProperty.value) {
        const propId = selectedConciergeDetailsProperty.value.id;
        selectedConciergeDetailsProperty.value = conciergeProperties.value.find(p => p.id === propId);
      }
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};
const openPropertyFullPage = (prop) => {
  selectedConciergeDetailsProperty.value = prop;
  emailReportPeriod.value.type = 'custom';
  emailReportPeriod.value.year = currentYear.value;
  emailReportPeriod.value.month = currentMonth.value;
  currentConciergeView.value = 'property-details';
  propertyDetailsTab.value = 'calendar';
  resetBookingForm();
};
const selectBookingForEdit = (b) => {
  bookingForm.value = {
    id: b.id,
    start_date: b.start_date,
    end_date: b.end_date,
    guest_name: b.guest_name || b.summary,
    price: b.price || 0,
    platform: b.platform || "resaoff",
    platform_fee: b.platform_fee || 0,
    commission_rate: b.commission_rate || 20,
    notes: b.notes || "",
    is_block: !!b.is_block
  };
  propertyDetailsTab.value = 'reservation-form';
  overlappingBookingsToOverwrite.value = [];
};

const resetBookingForm = () => {
  bookingForm.value = {
    id: null,
    start_date: "",
    end_date: "",
    guest_name: "",
    price: 0,
    platform: "resaoff",
    platform_fee: 0,
    commission_rate: 20,
    notes: "",
    is_block: false
  };
  quickBookingPropertyId.value = null;
  overlappingBookingsToOverwrite.value = [];
};
const openQuickBooking = () => {
  resetBookingForm();
  if (conciergeProperties.value.length === 0) {
    alert("Please add a property first before creating a reservation.");
    return;
  }
  quickBookingPropertyId.value = conciergeProperties.value[0].id;
  currentConciergeView.value = 'add-reservation';
};
const saveQuickBooking = async () => {
  if (!quickBookingPropertyId.value) {
    alert("Please select a property first.");
    return;
  }
  const token = localStorage.getItem("admin_token");
  const propId = quickBookingPropertyId.value;
  
  const payload = {
    start_date: bookingForm.value.start_date,
    end_date: bookingForm.value.end_date,
    guest_name: bookingForm.value.is_block ? "Blocked" : bookingForm.value.guest_name,
    price: bookingForm.value.is_block ? 0 : bookingForm.value.price,
    platform: bookingForm.value.is_block ? null : bookingForm.value.platform,
    platform_fee: bookingForm.value.is_block ? 0 : bookingForm.value.platform_fee,
    commission_rate: bookingForm.value.is_block ? 0 : bookingForm.value.commission_rate,
    is_block: !!bookingForm.value.is_block,
    notes: bookingForm.value.notes
  };
  
  try {
    if (overlappingBookingsToOverwrite.value.length > 0) {
      for (const bId of overlappingBookingsToOverwrite.value) {
        await deleteConciergeBookingSilent(bId);
      }
      overlappingBookingsToOverwrite.value = [];
    }
    const res = await fetch(`${backendUrl}/concierge/${propId}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchConciergeProperties();
      alert("Reservation added successfully!");
      resetBookingForm();
      currentConciergeView.value = 'calendar';
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};
const saveAdvancedBooking = async () => {
  const token = localStorage.getItem("admin_token");
  const propId = selectedConciergeDetailsProperty.value.id;
  const isEdit = bookingForm.value.id !== null;
  const url = isEdit 
    ? `${backendUrl}/concierge/bookings/${bookingForm.value.id}` 
    : `${backendUrl}/concierge/${propId}/bookings`;
  const method = isEdit ? "PUT" : "POST";
  
  const payload = {
    start_date: bookingForm.value.start_date,
    end_date: bookingForm.value.end_date,
    guest_name: bookingForm.value.is_block ? "Blocked" : bookingForm.value.guest_name,
    price: bookingForm.value.is_block ? 0 : bookingForm.value.price,
    platform: bookingForm.value.is_block ? null : bookingForm.value.platform,
    platform_fee: bookingForm.value.is_block ? 0 : bookingForm.value.platform_fee,
    commission_rate: bookingForm.value.is_block ? 0 : bookingForm.value.commission_rate,
    is_block: !!bookingForm.value.is_block,
    notes: bookingForm.value.notes
  };
  
  try {
    if (overlappingBookingsToOverwrite.value.length > 0) {
      for (const bId of overlappingBookingsToOverwrite.value) {
        await deleteConciergeBookingSilent(bId);
      }
      overlappingBookingsToOverwrite.value = [];
    }
    const res = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchConciergeProperties();
      selectedConciergeDetailsProperty.value = conciergeProperties.value.find(p => p.id === propId);
      alert(isEdit ? "Reservation updated successfully!" : "Reservation added successfully!");
      resetBookingForm();
      propertyDetailsTab.value = 'calendar';
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const deleteConciergeBookingInDetails = async (bookingId) => {
  if (!confirm("Are you sure you want to cancel this reservation?")) return;
  const token = localStorage.getItem("admin_token");
  const propId = selectedConciergeDetailsProperty.value.id;
  try {
    const res = await fetch(`${backendUrl}/concierge/bookings/${bookingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      await fetchConciergeProperties();
      selectedConciergeDetailsProperty.value = conciergeProperties.value.find(p => p.id === propId);
      alert("Reservation canceled successfully!");
      if (bookingForm.value.id === bookingId) {
        resetBookingForm();
      }
    } else {
      alert("Failed to delete booking.");
    }
  } catch (err) {
    alert("Network error.");
  }
};

const selectionState = ref({
  propertyId: null,
  startDate: null,
  endDate: null,
  hoverDate: null
});

const showCalendarSelectionModal = ref(false);

const handleDayCellMouseEnter = (prop, day) => {
  if (selectionState.value.propertyId === prop.id && selectionState.value.startDate && !selectionState.value.endDate) {
    selectionState.value.hoverDate = day;
  }
};

const handleDayCellClick = (prop, day) => {
  const state = selectionState.value;
  
  if (state.propertyId !== prop.id || !state.startDate) {
    // Start selection
    state.propertyId = prop.id;
    state.startDate = day;
    state.endDate = null;
    state.hoverDate = day;
  } else {
    // Second click
    if (state.startDate.getTime() === day.getTime()) {
      // Clicked the same day -> Single cell action
      const cellState = getBookingState(prop, day);
      openPropertyFullPage(prop);
      if (cellState.isBooked) {
        selectBookingForEdit(cellState.booking);
      } else {
        const dateStr = formatDateToISO(day);
        const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
        const nextDayStr = formatDateToISO(nextDay);
        
        bookingForm.value = {
          id: null,
          start_date: dateStr,
          end_date: nextDayStr,
          guest_name: "",
          price: 0,
          platform: "resaoff",
          platform_fee: 0,
          commission_rate: 20,
          notes: "",
          is_block: false
        };
      }
      cancelCalendarSelection();
    } else {
      // Clicked a different day -> Range selection complete
      state.endDate = day;
      showCalendarSelectionModal.value = true;
    }
  }
};

const cancelCalendarSelection = () => {
  selectionState.value = {
    propertyId: null,
    startDate: null,
    endDate: null,
    hoverDate: null
  };
  showCalendarSelectionModal.value = false;
};

const selectedPropertyTitle = computed(() => {
  if (!selectionState.value.propertyId) return "";
  const prop = conciergeProperties.value.find(p => p.id === selectionState.value.propertyId);
  return prop ? prop.title : "";
});

const formattedSelectionDates = computed(() => {
  const state = selectionState.value;
  if (!state.startDate) return "";
  
  const d1 = state.startDate;
  const d2 = state.endDate || state.hoverDate || d1;
  
  const min = new Date(Math.min(d1.getTime(), d2.getTime()));
  const max = new Date(Math.max(d1.getTime(), d2.getTime()));
  
  return `${formatDateToEU(formatDateToISO(min))} - ${formatDateToEU(formatDateToISO(max))}`;
});

const handleCalendarAction = async (action) => {
  const state = selectionState.value;
  if (!state.startDate || !state.propertyId) return;

  const d1 = state.startDate;
  const d2 = state.endDate || state.hoverDate || d1;
  
  const min = new Date(Math.min(d1.getTime(), d2.getTime()));
  const max = new Date(Math.max(d1.getTime(), d2.getTime()));
  
  const startDateStr = formatDateToISO(min);
  const endDateStr = formatDateToISO(max);

  const token = localStorage.getItem("admin_token");
  const propId = state.propertyId;

  if (action === 'block') {
    const overlaps = checkConciergeOverlap(propId, startDateStr, endDateStr);
    if (overlaps.length > 0) {
      if (!confirm("You are making a change on a day that is not empty in the calendar. Are you sure?")) {
        cancelCalendarSelection();
        return;
      }
      overlappingBookingsToOverwrite.value = overlaps.map(o => o.id);
    } else {
      overlappingBookingsToOverwrite.value = [];
    }

    const payload = {
      start_date: startDateStr,
      end_date: endDateStr,
      guest_name: "Blocked",
      price: 0,
      platform: "resaoff",
      platform_fee: 0,
      commission_rate: 0,
      is_block: true,
      notes: "Blocked via calendar selection"
    };

    try {
      if (overlappingBookingsToOverwrite.value.length > 0) {
        for (const bId of overlappingBookingsToOverwrite.value) {
          await deleteConciergeBookingSilent(bId);
        }
        overlappingBookingsToOverwrite.value = [];
      }
      const res = await fetch(`${backendUrl}/concierge/${propId}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchConciergeProperties();
        if (currentConciergeView.value === 'property-details') {
          selectedConciergeDetailsProperty.value = conciergeProperties.value.find(p => p.id === propId);
        }
        alert("Calendar range successfully blocked!");
      } else {
        const err = await res.json();
        alert(`Error: ${err.detail}`);
      }
    } catch (err) {
      alert("Network error.");
    }
    cancelCalendarSelection();
  } else if (action === 'unblock') {
    try {
      const url = `${backendUrl}/concierge/${propId}/unblock?start_date=${startDateStr}&end_date=${endDateStr}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        await fetchConciergeProperties();
        if (currentConciergeView.value === 'property-details') {
          selectedConciergeDetailsProperty.value = conciergeProperties.value.find(p => p.id === propId);
        }
        alert("Calendar range successfully opened!");
      } else {
        const err = await res.json();
        alert(`Error: ${err.detail}`);
      }
    } catch (err) {
      alert("Network error.");
    }
    cancelCalendarSelection();
  } else if (action === 'book') {
    const overlaps = checkConciergeOverlap(propId, startDateStr, endDateStr);
    if (overlaps.length > 0) {
      if (!confirm("You are making a change on a day that is not empty in the calendar. Are you sure?")) {
        cancelCalendarSelection();
        return;
      }
      overlappingBookingsToOverwrite.value = overlaps.map(o => o.id);
    } else {
      overlappingBookingsToOverwrite.value = [];
    }

    if (currentConciergeView.value === 'property-details') {
      propertyDetailsTab.value = 'reservation-form';
    } else {
      currentConciergeView.value = 'add-reservation';
      quickBookingPropertyId.value = propId;
    }
    bookingForm.value = {
      id: null,
      start_date: startDateStr,
      end_date: endDateStr,
      guest_name: "",
      price: 0,
      platform: "resaoff",
      platform_fee: 0,
      commission_rate: 20,
      notes: "",
      is_block: false
    };
    cancelCalendarSelection();
  }
};

const isCellSelected = (prop, day) => {
  const state = selectionState.value;
  if (state.propertyId !== prop.id || !state.startDate) return false;
  
  const start = state.startDate.getTime();
  const end = state.endDate ? state.endDate.getTime() : (state.hoverDate ? state.hoverDate.getTime() : start);
  
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  const cur = day.getTime();
  
  return cur >= min && cur <= max;
};

const fetchUsers = async () => {
  if (!isSuperuser.value) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleLogout();
    users.value = await res.json();
  } catch (err) {
    console.error("Failed to fetch users", err);
  }
};

const fetchBlogPosts = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/blog-posts/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleLogout();
    blogPosts.value = await res.json();
  } catch (err) {
    console.error("Failed to fetch blog posts", err);
  }
};

const approveBlogPost = async (id) => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/blog-posts/${id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchBlogPosts();
      alert("Post approved!");
    } else {
      alert("Approval failed.");
    }
  } catch (err) {
    alert("Network error.");
  }
};

const isEditing = ref(false);
const editingId = ref(null);
const showPropertyForm = ref(false);

const startAddProperty = () => {
  isEditing.value = false;
  editingId.value = null;
  resetForm();
  showPropertyForm.value = true;
};

const startEdit = (prop) => {
  isEditing.value = true;
  editingId.value = prop.id;
  // Clone to avoid direct mutation
  const clone = JSON.parse(JSON.stringify(prop));
  // Convert transport_info string to array for checkboxes
  if (
    clone.details.transport_info &&
    typeof clone.details.transport_info === "string"
  ) {
    clone.details.transport_info = clone.details.transport_info.split(", ");
  } else if (!clone.details.transport_info) {
    clone.details.transport_info = [];
  }
  newProperty.value = clone;
  showPropertyForm.value = true;
  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const cancelEdit = () => {
  isEditing.value = false;
  editingId.value = null;
  showPropertyForm.value = false;
  resetForm();
};

const resetForm = () => {
  newProperty.value = {
    title: "",
    price: 0,
    listing_type: "buy",
    status: "active",
    details: {
      description: "",
      description_en: "",
      description_fr: "",
      description_tr: "",
      bedrooms: 0,
      bathrooms: 0,
      sqft: 0,
      address: "",
      neighborhood: "",
      property_type: "Apartment",
      energy_class: "A",
      has_parking: false,
      has_balcony: false,
      has_cave: false,
      has_elevator: false,
      floor: null,
      total_floors: null,
      available_date: "",
      transport_info: [],
      lat: null,
      lng: null,
    },
    media: [],
  };
};

const updateProperty = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const payload = JSON.parse(JSON.stringify(newProperty.value));
    // Convert transport_info array to string for backend
    if (Array.isArray(payload.details.transport_info)) {
      payload.details.transport_info =
        payload.details.transport_info.join(", ");
    }

    const res = await fetch(`${backendUrl}/properties/${editingId.value}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await fetchProperties();
      alert("Property updated successfully!");
      cancelEdit();
    } else {
      if (res.status === 401) return handleLogout();
      const errorData = await res.json();
      alert(`Error: ${errorData.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const addProperty = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const payload = JSON.parse(JSON.stringify(newProperty.value));
    // Convert transport_info array to string for backend
    if (Array.isArray(payload.details.transport_info)) {
      payload.details.transport_info =
        payload.details.transport_info.join(", ");
    }

    const res = await fetch(`${backendUrl}/properties/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await fetchProperties();
      alert("Property added successfully!");
      resetForm();
      showPropertyForm.value = false;
    } else {
      if (res.status === 401) return handleLogout();
      const errorData = await res.json();
      alert(`Error: ${errorData.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const isEditingBlog = ref(false);
const editingBlogId = ref(null);
const showBlogForm = ref(false);

const startAddBlog = () => {
  isEditingBlog.value = false;
  editingBlogId.value = null;
  resetBlogForm();
  showBlogForm.value = true;
};

const startEditBlog = (post) => {
  isEditingBlog.value = true;
  editingBlogId.value = post.id;
  newBlogPost.value = JSON.parse(JSON.stringify(post));
  showBlogForm.value = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const cancelEditBlog = () => {
  isEditingBlog.value = false;
  editingBlogId.value = null;
  showBlogForm.value = false;
  resetBlogForm();
};

const resetBlogForm = () => {
  newBlogPost.value = {
    slug: "",
    title_en: "",
    title_fr: "",
    title_tr: "",
    content_en: "",
    content_fr: "",
    content_tr: "",
    excerpt_en: "",
    excerpt_fr: "",
    excerpt_tr: "",
    image_url: "",
    is_published: true,
  };
};

const addBlogPost = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/blog-posts/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newBlogPost.value),
    });
    if (res.ok) {
      await fetchBlogPosts();
      alert("Blog post added successfully!");
      resetBlogForm();
      showBlogForm.value = false;
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const updateBlogPost = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/blog-posts/${editingBlogId.value}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newBlogPost.value),
    });
    if (res.ok) {
      await fetchBlogPosts();
      alert("Blog post updated successfully!");
      cancelEditBlog();
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const deleteBlogPost = async (id) => {
  if (!confirm("Are you sure?")) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/blog-posts/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchBlogPosts();
    } else {
      alert("Failed to delete blog post.");
    }
  } catch (err) {
    alert("Network error.");
  }
};

const deleteProperty = async (id) => {
  if (!isSuperuser.value) {
    alert("Only superusers can delete properties.");
    return;
  }
  const token = localStorage.getItem("admin_token");
  if (!confirm("Are you sure?")) return;
  try {
    const res = await fetch(`${backendUrl}/properties/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchProperties();
    } else {
      if (res.status === 401) return handleLogout();
      alert("Failed to delete.");
    }
  } catch (err) {
    alert("Network error.");
  }
};

const currentUserEmail = computed(() => {
  try {
    const token = localStorage.getItem("admin_token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub;
  } catch (e) {
    return null;
  }
});

const deleteAdminUser = async (id, email) => {
  if (email === currentUserEmail.value) {
    alert("You cannot delete your own account.");
    return;
  }
  if (!confirm(`Are you sure you want to delete ${email}?`)) return;

  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchUsers();
      alert("User deleted successfully.");
    } else {
      if (res.status === 401) return handleLogout();
      const errorData = await res.json();
      alert(`Error: ${errorData.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const createAdminUser = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newUser.value),
    });

    if (res.ok) {
      await fetchUsers();
      alert("User created successfully!");
      newUser.value = {
        email: "",
        full_name: "",
        role: "editor",
      };
    } else {
      const errorData = await res.json();
      alert(`Error: ${errorData.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const isUploading = ref(false);

const handleFileUpload = async (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const token = localStorage.getItem("admin_token");
  isUploading.value = true;

  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${backendUrl}/upload/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        newProperty.value.media.push({
          url: data.url,
          public_id: data.public_id,
          media_type: "image",
          is_thumbnail: newProperty.value.media.length === 0,
        });
      } else {
        alert("Failed to upload an image.");
      }
    }
  } catch (err) {
    console.error("Upload error", err);
    alert("Network error during upload.");
  } finally {
    isUploading.value = false;
    // Reset input
    event.target.value = "";
  }
};

const handleBlogImageUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const token = localStorage.getItem("admin_token");
  isUploading.value = true;
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${backendUrl}/upload/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      newBlogPost.value.image_url = data.url;
    }
  } catch (err) {
    alert("Upload failed.");
  } finally {
    isUploading.value = false;
  }
};

const removeMedia = async (index) => {
  const mediaItem = newProperty.value.media[index];

  if (mediaItem.public_id) {
    const token = localStorage.getItem("admin_token");
    try {
      // Encode public_id because it might contain slashes
      const encodedId = encodeURIComponent(mediaItem.public_id);
      const res = await fetch(`${backendUrl}/upload/${encodedId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json();
        console.error("Failed to delete from Cloudinary:", errData.detail);
        alert(
          "Failed to delete image from server. It might already be deleted or restricted.",
        );
      }
    } catch (err) {
      console.error("Network error during Cloudinary deletion", err);
      alert("Network error: Could not confirm image deletion from Cloudinary.");
    }
  }

  newProperty.value.media.splice(index, 1);
};

// Drag and Drop reordering for Property Images
const draggedMediaIndex = ref(null);

const handleDragStart = (idx, event) => {
  draggedMediaIndex.value = idx;
  event.dataTransfer.effectAllowed = "move";
  // Add a ghost image styling if needed
  if (event.currentTarget) {
    event.currentTarget.classList.add("dragging");
  }
};

const handleDragOver = (idx, event) => {
  event.preventDefault();
};

const handleDrop = (idx, event) => {
  event.preventDefault();
  const draggedIdx = draggedMediaIndex.value;
  if (draggedIdx === null || draggedIdx === idx) return;

  const mediaList = [...newProperty.value.media];
  const draggedItem = mediaList.splice(draggedIdx, 1)[0];
  mediaList.splice(idx, 0, draggedItem);

  newProperty.value.media = mediaList;
  draggedMediaIndex.value = null;
};

const handleDragEnd = (event) => {
  draggedMediaIndex.value = null;
  if (event.currentTarget) {
    event.currentTarget.classList.remove("dragging");
  }
};


const fetchContactMessages = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/contact-messages/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      contactMessages.value = await res.json();
    } else {
      if (res.status === 401) handleLogout();
    }
  } catch (err) {
    console.error("Failed to fetch contact messages", err);
  }
};

const markMessageAsRead = async (id, isRead) => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(
      `${backendUrl}/admin/contact-messages/${id}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_read: isRead }),
      },
    );
    if (res.ok) {
      await fetchContactMessages();
    }
  } catch (err) {
    console.error(err);
  }
};

const deleteContactMessage = async (id) => {
  if (!confirm("Are you sure you want to delete this message?")) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/contact-messages/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchContactMessages();
    } else {
      alert("Failed to delete message. Only superusers can delete.");
    }
  } catch (err) {
    console.error(err);
  }
};

const fetchPasswordResets = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/password-resets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      passwordResets.value = await res.json();
    }
  } catch (err) {
    console.error(err);
  }
};

const approvePasswordReset = async (id) => {
  const token = localStorage.getItem("admin_token");
  if (
    !confirm(
      "Are you sure you want to approve this reset and change their password to 'Servet1965!'?",
    )
  )
    return;
  try {
    const res = await fetch(
      `${backendUrl}/admin/password-resets/${id}/approve`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.ok) {
      alert(
        "Password reset successfully. The user must change it upon their next login.",
      );
      fetchPasswordResets();
    } else {
      alert("Failed to reset password.");
    }
  } catch (err) {
    console.error(err);
  }
};

const fetchResearchListings = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/research-listings/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      researchListings.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch research listings", err);
  }
};

const buildResearchPayload = () => {
  const payload = { ...newResearch.value };
  const isApartment = ["apartment_sale", "apartment_rent"].includes(payload.property_type);

  if (!isApartment) {
    return {
      ...payload,
      rooms: 0,
      address: "",
      neighborhood: "",
      zip_code: "",
      dpe: null,
      has_balcony: false,
      has_parking: false,
      has_garden: false,
      has_elevator: false,
      floor: null,
      total_floors: null,
      heating_system: null,
    };
  }

  return payload;
};

const addResearchListing = async () => {
  // URL uniqueness check
  const exists = researchListings.value.some(
    (l) => l.url.toLowerCase().trim() === newResearch.value.url.toLowerCase().trim()
  );
  if (exists) {
    alert("This URL already exists in the research list! / Bu URL zaten listede mevcut!");
    return;
  }

  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/research-listings/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(buildResearchPayload()),
    });

    if (res.ok) {
      await fetchResearchListings();
      alert("Research listing added!");
      resetResearchForm();
      showResearchForm.value = false;
    } else {
      const errData = await res.json();
      alert(`Error: ${errData.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const startAddResearch = () => {
  isEditingResearch.value = false;
  editingResearchId.value = null;
  resetResearchForm();
  newResearch.value.property_type = researchSubTab.value;
  showResearchForm.value = true;
};

const startEditResearch = (listing) => {
  isEditingResearch.value = true;
  editingResearchId.value = listing.id;
  newResearch.value = {
    url: listing.url,
    rooms: listing.rooms,
    address: listing.address,
    neighborhood: listing.neighborhood,
    zip_code: listing.zip_code,
    dpe: listing.dpe || "A",
    price: Number(listing.price),
    square_meters: Number(listing.square_meters),
    buyer_id: listing.buyer_id,
    has_balcony: listing.has_balcony,
    has_parking: listing.has_parking,
    has_garden: listing.has_garden,
    has_elevator: listing.has_elevator,
    floor: listing.floor,
    total_floors: listing.total_floors,
    heating_system: listing.heating_system || "Electric",
    internal_notes: listing.internal_notes || listing.internalNotes || "",
    property_type: listing.property_type || "apartment_sale",
    tag_ids: listing.tags ? listing.tags.map((t) => t.id) : [],
  };
  showResearchForm.value = true;
  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const cancelEditResearch = () => {
  showResearchForm.value = false;
  resetResearchForm();
};

const updateResearchListing = async () => {
  // URL uniqueness check
  const exists = researchListings.value.some(
    (l) =>
      l.url.toLowerCase().trim() === newResearch.value.url.toLowerCase().trim() &&
      l.id !== editingResearchId.value
  );
  if (exists) {
    alert("This URL already exists in another listing!");
    return;
  }

  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(
      `${backendUrl}/admin/research-listings/${editingResearchId.value}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...buildResearchPayload(),
          internal_notes: newResearch.value.internal_notes,
        }),
      },
    );

    if (res.ok) {
      await fetchResearchListings();
      alert("Research listing updated!");
      cancelEditResearch();
    } else {
      const errData = await res.json();
      alert(`Error: ${errData.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const deleteResearchListing = async (id) => {
  if (!confirm("Are you sure?")) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/research-listings/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchResearchListings();
      alert("Research listing deleted!");
    }
  } catch (err) {
    alert("Network error.");
  }
};

const fetchBuyers = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/buyers/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) buyers.value = await res.json();
  } catch (err) {
    console.error("Error fetching buyers:", err);
  }
};

const addBuyer = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/buyers/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newBuyer.value),
    });
    if (res.ok) {
      alert("Buyer added!");
      newBuyer.value = { full_name: "", email: "", phone: "" };
      await fetchBuyers();
    } else {
      const err = await res.json();
      alert(`Error: ${err.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
};

const deleteBuyer = async (id) => {
  if (!confirm("Remove this buyer?")) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/buyers/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchBuyers();
      alert("Buyer removed.");
    }
  } catch (err) {
    alert("Network error.");
  }
};

const fetchResearchTags = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/research-tags/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) tags.value = await res.json();
  } catch (err) {
    console.error("Error fetching tags:", err);
  }
};

const addResearchTag = async () => {
  if (!newTagName.value) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/research-tags/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: newTagName.value }),
    });
    if (res.ok) {
      newTagName.value = "";
      await fetchResearchTags();
    } else {
      const err = await res.json();
      alert(err.detail || "Failed to add tag");
    }
  } catch (err) {
    alert("Network error.");
  }
};

const deleteResearchTag = async (id) => {
  if (!confirm("Delete this tag?")) return;
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/research-tags/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) await fetchResearchTags();
  } catch (err) {
    alert("Network error.");
  }
};

// Timeline Property Filter State
const selectedTimelineProperties = ref([]);
const timelinePropertySearch = ref('');
const showTimelinePropertyDropdown = ref(false);

const filteredTimelinePropertiesDropdown = computed(() => {
  if (!timelinePropertySearch.value) {
    return conciergeProperties.value;
  }
  const q = timelinePropertySearch.value.toLowerCase();
  return conciergeProperties.value.filter(p => p.title && p.title.toLowerCase().includes(q));
});

const filteredTimelineProperties = computed(() => {
  if (selectedTimelineProperties.value.length === 0) {
    return conciergeProperties.value;
  }
  return conciergeProperties.value.filter(p => selectedTimelineProperties.value.includes(p.id));
});

const toggleTimelineProperty = (id) => {
  const index = selectedTimelineProperties.value.indexOf(id);
  if (index > -1) {
    selectedTimelineProperties.value.splice(index, 1);
  } else {
    selectedTimelineProperties.value.push(id);
  }
};

const clearTimelineProperties = () => {
  selectedTimelineProperties.value = [];
};

const selectAllTimelineProperties = () => {
  selectedTimelineProperties.value = conciergeProperties.value.map(p => p.id);
};

const closeTimelineDropdown = (e) => {
  if (!e.target.closest('.timeline-property-filter-container')) {
    showTimelinePropertyDropdown.value = false;
  }
};

const handlePropertyDetailsCellClick = (prop, day) => {
  const state = selectionState.value;
  if (state.propertyId !== prop.id || !state.startDate) {
    // Start range selection
    state.propertyId = prop.id;
    state.startDate = day;
    state.endDate = null;
    state.hoverDate = day;
  } else {
    // Second click – show action modal (same as main calendar)
    state.endDate = day;
    showCalendarSelectionModal.value = true;
  }
};
const propertyCalendarWeeks = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;
  
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  
  const days = [];
  
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDate - i);
    days.push({ date: d, isCurrentMonth: false });
  }
  
  const currentMonthLastDate = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= currentMonthLastDate; i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, isCurrentMonth: true });
  }
  
  const totalCells = Math.ceil(days.length / 7) * 7;
  const nextMonthDaysToAdd = totalCells - days.length;
  for (let i = 1; i <= nextMonthDaysToAdd; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ date: d, isCurrentMonth: false });
  }
  
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
});

const getGridDayEvents = (prop, dateObj) => {
  if (!prop || !prop.bookings) return [];
  const dateStr = formatDateToISO(dateObj);
  
  const events = [];
  
  prop.bookings.forEach(b => {
    if (b.start_date === dateStr) {
      events.push({ type: 'in', booking: b });
    } else if (b.end_date === dateStr) {
      events.push({ type: 'out', booking: b });
    } else if (b.start_date < dateStr && dateStr < b.end_date) {
      events.push({ type: 'stay', booking: b });
    }
  });
  
  return events;
};const getPlatformColor = (booking) => {
  const platform = (booking.platform || '').toLowerCase();
  if (booking.is_block) return '#64748b';
  if (platform === 'airbnb') return '#ef4444';
  if (platform === 'booking') return '#2563eb';
  return '#f97316';
};const checkConciergeOverlap = (propertyId, startDateStr, endDateStr, excludeBookingId = null) => {
  const prop = conciergeProperties.value.find(p => p.id === propertyId);
  if (!prop || !prop.bookings) return [];
  return prop.bookings.filter(b => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    return b.start_date < endDateStr && b.end_date > startDateStr;
  });
};

const deleteConciergeBookingSilent = async (bookingId) => {
  const token = localStorage.getItem("admin_token");
  try {
    await fetch(`${backendUrl}/concierge/bookings/${bookingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (err) {
    console.error("Failed to delete overlapping booking silently:", err);
  }
};

onMounted(async () => {
  fetchProperties();
  fetchBlogPosts();
  fetchContactMessages();
  fetchResearchListings();
  fetchBuyers();
  fetchResearchTags();
  fetchConciergeProperties();
  fetchConciergeReports();
  fetchCleaners();
  fetchCleaningAssignments();
  fetchReportCleaningAssignments();
  fetchCleanerTransactions();

  window.addEventListener('click', closeTimelineDropdown);

  if (isSuperuser.value) {
    fetchUsers();
    fetchPasswordResets();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('click', closeTimelineDropdown);
});

watch(cleaningSelectedDate, () => {
  fetchCleaningAssignments();
});
</script>

<template>
  <div class="admin-view">
    <!-- SIDEBAR -->
    <aside class="admin-sidebar">
      <div class="sidebar-branding">
        <div class="logo-wrapper">
          <img
            src="/doormanlogo.webp"
            alt="Doorman Admin"
            class="sidebar-logo-img"
          />
        </div>
        <span class="sidebar-title">Doorman Admin</span>
      </div>

      <nav class="sidebar-tabs">
        <button
          @click="activeTab = 'properties'"
          :class="{ active: activeTab === 'properties' }"
          class="sidebar-tab-btn"
          title="Properties"
        >
          <span class="material-icons-outlined">apartment</span>
          <span class="tab-label">Properties</span>
        </button>

        <button
          @click="activeTab = 'blogs'"
          :class="{ active: activeTab === 'blogs' }"
          class="sidebar-tab-btn"
          title="Blog Posts"
        >
          <span class="material-icons-outlined">article</span>
          <span class="tab-label">Blog Posts</span>
        </button>

        <button
          @click="activeTab = 'research'"
          :class="{ active: activeTab === 'research' }"
          class="sidebar-tab-btn"
          title="Research"
        >
          <span class="material-icons-outlined">analytics</span>
          <span class="tab-label">Research</span>
        </button>

        <button
          @click="activeTab = 'concierge'"
          :class="{ active: activeTab === 'concierge' }"
          class="sidebar-tab-btn"
          title="Concierge"
        >
          <span class="material-icons-outlined">room_service</span>
          <span class="tab-label">Concierge</span>
        </button>

        <button
          v-if="isSuperuser"
          @click="activeTab = 'users'"
          :class="{ active: activeTab === 'users' }"
          class="sidebar-tab-btn"
          title="User Management"
        >
          <span class="material-icons-outlined">people</span>
          <span class="tab-label">Users</span>
        </button>

        <button
          @click="activeTab = 'messages'"
          :class="{ active: activeTab === 'messages' }"
          class="sidebar-tab-btn"
          title="Contact Messages"
        >
          <div class="icon-badge-wrapper">
            <span class="material-icons-outlined">email</span>
            <span v-if="unreadMessagesCount > 0" class="unread-badge-dot"></span>
          </div>
          <span class="tab-label">Messages</span>
          <span v-if="unreadMessagesCount > 0" class="unread-badge-text">{{
            unreadMessagesCount
          }}</span>
        </button>

        <button
          @click="activeTab = 'profile'"
          :class="{ active: activeTab === 'profile' }"
          class="sidebar-tab-btn"
          title="Profile"
        >
          <span class="material-icons-outlined">manage_accounts</span>
          <span class="tab-label">Profile</span>
        </button>
      </nav>

      <!-- SIDEBAR FOOTER -->
      <div class="sidebar-footer">
        <div class="user-info">
          <span class="material-icons-outlined user-avatar">account_circle</span>
          <div class="user-meta">
            <span class="user-email">{{ userEmail }}</span>
            <span class="role-badge" :class="userRole">{{ userRole }}</span>
          </div>
        </div>
        <button @click="handleLogout" class="sidebar-logout-btn" title="Logout">
          <span class="material-icons-outlined">logout</span>
          <span class="tab-label">Logout</span>
        </button>
      </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="admin-main-content">
      <div class="admin-content-wrap">

      <!-- PROPERTIES MANAGEMENT -->
      <div v-if="activeTab === 'properties'" class="tab-content">
        <!-- Header row -->
        <div class="tab-header-row">
          <h1 class="tab-title">{{ showPropertyForm ? (isEditing ? 'Edit Property' : 'Add New Property') : 'Properties' }}</h1>
          <button 
            v-if="!showPropertyForm" 
            @click="startAddProperty" 
            class="action-header-btn"
          >
            <span class="material-icons-outlined">add</span>
            Add New Property
          </button>
          <button 
            v-else 
            @click="cancelEdit" 
            class="action-header-btn secondary-btn"
          >
            <span class="material-icons-outlined">arrow_back</span>
            Back to List
          </button>
        </div>

        <!-- Add/Edit Form -->
        <section v-if="showPropertyForm" class="admin-section card" :class="{ 'edit-mode': isEditing }">
          <form
            @submit.prevent="isEditing ? updateProperty() : addProperty()"
            class="admin-form"
          >
            <div class="form-grid">
              <div class="form-field">
                <label>Title</label>
                <input v-model="newProperty.title" type="text" required />
              </div>
              <div class="form-field">
                <label>Price (€)</label>
                <input
                  v-model.number="newProperty.price"
                  type="number"
                  required
                />
              </div>
              <div class="form-field">
                <label>Type</label>
                <select v-model="newProperty.listing_type">
                  <option value="buy">Buy</option>
                  <option value="rent">Rent</option>
                </select>
              </div>
              <div class="form-field">
                <label>Status</label>
                <select v-model="newProperty.status">
                  <option value="active">Active</option>
                  <option value="sold">Sold</option>
                  <option value="rented">Rented</option>
                </select>
              </div>
              <div class="form-field">
                <label>Address</label>
                <input
                  v-model="newProperty.details.address"
                  type="text"
                  required
                />
              </div>
              <div class="form-field">
                <label>Neighborhood (Bolge)</label>
                <input
                  v-model="newProperty.details.neighborhood"
                  type="text"
                  placeholder="e.g. Marais, Saint Germain"
                />
              </div>
              <div class="form-field">
                <label>Property Type</label>
                <select v-model="newProperty.details.property_type">
                  <option value="Apartment">Apartment</option>
                  <option value="Penthouse">Penthouse</option>
                  <option value="Townhouse">Townhouse</option>
                  <option value="Villa">Villa</option>
                </select>
              </div>
              <div class="form-field">
                <label>Area (m²)</label>
                <input
                  v-model.number="newProperty.details.sqft"
                  type="number"
                />
              </div>
              <div class="form-field">
                <label>Bedrooms</label>
                <input
                  v-model.number="newProperty.details.bedrooms"
                  type="number"
                />
              </div>
              <div class="form-field">
                <label>Bathrooms</label>
                <input
                  v-model.number="newProperty.details.bathrooms"
                  type="number"
                />
              </div>
              <div class="form-field">
                <label>Floor</label>
                <input
                  v-model.number="newProperty.details.floor"
                  type="number"
                />
              </div>
              <div class="form-field">
                <label>Total Floors</label>
                <input
                  v-model.number="newProperty.details.total_floors"
                  type="number"
                />
              </div>
              <div class="form-field">
                <label>Availability (Empty = Available Now)</label>
                <input
                  v-model="newProperty.details.available_date"
                  type="text"
                  placeholder="e.g. 1st April 2026"
                />
              </div>
              <div class="form-field">
                <label>Energy Class (DPE)</label>
                <select v-model="newProperty.details.energy_class">
                  <option
                    v-for="c in ['A', 'B', 'C', 'D', 'E', 'F', 'G']"
                    :key="c"
                    :value="c"
                  >
                    {{ c }}
                  </option>
                </select>
              </div>
              <div class="form-field full-width">
                <label>Transport Proximity</label>
                <div class="transport-selector">
                  <div class="selected-transports">
                    <div
                      v-for="opt in newProperty.details.transport_info"
                      :key="opt"
                      class="transport-tag"
                    >
                      {{ opt }}
                      <span
                        class="material-icons-outlined remove-tag"
                        @click="toggleTransport(opt)"
                        >close</span
                      >
                    </div>
                    <button
                      type="button"
                      class="add-transport-btn"
                      @click="showTransportMenu = !showTransportMenu"
                    >
                      <span class="material-icons-outlined">add</span>
                      Add Transport
                    </button>
                  </div>

                  <div
                    v-if="showTransportMenu"
                    class="transport-dropdown-overlay"
                    @click="showTransportMenu = false"
                  ></div>
                  <div v-if="showTransportMenu" class="transport-dropdown">
                    <div class="dropdown-header">
                      <span>Select Transport</span>
                      <span
                        class="material-icons-outlined close-dropdown"
                        @click="showTransportMenu = false"
                        >close</span
                      >
                    </div>
                    <div class="dropdown-grid">
                      <div
                        v-for="opt in transportOptions"
                        :key="opt"
                        class="dropdown-item"
                        :class="{
                          selected:
                            newProperty.details.transport_info.includes(opt),
                        }"
                        @click="toggleTransport(opt)"
                      >
                        <span class="material-icons-outlined icon">
                          {{
                            newProperty.details.transport_info.includes(opt)
                              ? "check_circle"
                              : "circle"
                          }}
                        </span>
                        {{ opt }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="form-field">
                <label>Latitude</label>
                <input
                  v-model.number="newProperty.details.lat"
                  type="number"
                  step="any"
                />
              </div>
              <div class="form-field">
                <label>Longitude</label>
                <input
                  v-model.number="newProperty.details.lng"
                  type="number"
                  step="any"
                />
              </div>
              <div class="form-field full-width">
                <div class="description-header">
                  <label>Description</label>
                  <div class="lang-tabs">
                    <button
                      type="button"
                      class="lang-tab"
                      :class="{ active: descriptionTab === 'en' }"
                      @click="descriptionTab = 'en'"
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      class="lang-tab"
                      :class="{ active: descriptionTab === 'fr' }"
                      @click="descriptionTab = 'fr'"
                    >
                      FR
                    </button>
                    <button
                      type="button"
                      class="lang-tab"
                      :class="{ active: descriptionTab === 'tr' }"
                      @click="descriptionTab = 'tr'"
                    >
                      TR
                    </button>
                  </div>
                </div>

                <textarea
                  v-if="descriptionTab === 'en'"
                  v-model="newProperty.details.description_en"
                  rows="4"
                  placeholder="English description..."
                ></textarea>
                <textarea
                  v-else-if="descriptionTab === 'fr'"
                  v-model="newProperty.details.description_fr"
                  rows="4"
                  placeholder="Description en Français..."
                ></textarea>
                <textarea
                  v-else-if="descriptionTab === 'tr'"
                  v-model="newProperty.details.description_tr"
                  rows="4"
                  placeholder="Turkish description..."
                ></textarea>
              </div>
              <div class="form-field checkboxes">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    v-model="newProperty.details.has_parking"
                  />
                  Parking
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    v-model="newProperty.details.has_balcony"
                  />
                  Balcony
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    v-model="newProperty.details.has_cave"
                  />
                  Cave
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    v-model="newProperty.details.has_elevator"
                  />
                  Elevator
                </label>
              </div>

              <!-- Media Section -->
              <div class="form-field full-width media-section">
                <label>Property Images</label>
                <div class="upload-trigger">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    @change="handleFileUpload"
                    id="file-upload"
                    class="file-input"
                  />
                  <label for="file-upload" class="upload-btn">
                    <span class="material-icons-outlined">add_a_photo</span>
                    {{ isUploading ? "Uploading..." : "Upload Photos" }}
                  </label>
                </div>

                <div v-if="newProperty.media.length > 0" class="media-previews">
                  <div
                    v-for="(m, idx) in newProperty.media"
                    :key="idx"
                    class="preview-item"
                    draggable="true"
                    @dragstart="handleDragStart(idx, $event)"
                    @dragover="handleDragOver(idx, $event)"
                    @drop="handleDrop(idx, $event)"
                    @dragend="handleDragEnd($event)"
                    :style="draggedMediaIndex === idx ? 'opacity: 0.4; border: 2px dashed var(--accent);' : ''"
                  >
                    <!-- Drag handle icon -->
                    <div class="drag-handle" style="position: absolute; top: 5px; left: 5px; background: rgba(255,255,255,0.8); border-radius: 3px; padding: 2px; display: flex; align-items: center; justify-content: center; cursor: grab; box-shadow: 0 1px 3px rgba(0,0,0,0.15); z-index: 10;">
                      <span class="material-icons-outlined" style="font-size: 1rem; color: var(--primary);">drag_indicator</span>
                    </div>
                    <img :src="m.url" alt="Preview" style="cursor: grab;" />
                    <button
                      type="button"
                      @click="removeMedia(idx)"
                      class="remove-media"
                    >
                      <span class="material-icons-outlined">close</span>
                    </button>
                    <div class="thumbnail-toggle">
                      <input
                        type="checkbox"
                        v-model="m.is_thumbnail"
                        @change="
                          () => {
                            if (m.is_thumbnail) {
                              newProperty.media.forEach((other, oIdx) => {
                                if (oIdx !== idx) other.is_thumbnail = false;
                              });
                            }
                          }
                        "
                      />
                      Cover Image
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              class="form-actions"
              style="margin-top: 2rem; display: flex; gap: 1rem"
            >
              <button type="submit" class="submit-btn">
                {{ isEditing ? "Save Changes" : "Add Property" }}
              </button>
              <button
                v-if="isEditing"
                type="button"
                @click="cancelEdit"
                class="cancel-btn"
              >
                Cancel Edit
              </button>
            </div>
          </form>
        </section>

        <!-- List -->
        <section v-else class="admin-section card">
          <h2 class="section-subtitle">Existing Properties</h2>
          <div v-if="isLoading">Loading...</div>
          <div v-else class="property-list">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Address</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Added By</th>
                  <th>Date</th>
                  <th>Last Edit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="prop in properties" :key="prop.id">
                  <td>{{ prop.id }}</td>
                  <td
                    class="address-cell"
                    :title="prop.details?.address || prop.title"
                  >
                    {{ prop.details?.address || prop.title }}
                  </td>
                  <td>
                    €
                    {{
                      Number(prop.price).toLocaleString("de-DE", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })
                    }}
                  </td>
                  <td>
                    <span class="status-pill" :class="prop.status">
                      {{ prop.status }}
                    </span>
                  </td>
                  <td>
                    <span class="audit-user text-muted" v-if="prop.created_by">
                      {{ prop.created_by.full_name || prop.created_by.email }}
                    </span>
                  </td>
                  <td>
                    <span class="audit-date" v-if="prop.created_at">
                      {{
                        new Date(prop.created_at).toLocaleDateString("tr-TR")
                      }}
                    </span>
                  </td>
                  <td>
                    <span class="audit-user text-muted" v-if="prop.updated_by">
                      {{ prop.updated_by.full_name || prop.updated_by.email }}
                    </span>
                  </td>
                  <td>
                    <div
                      style="
                        display: flex;
                        gap: 0.5rem;
                        align-items: center;
                        flex-wrap: nowrap;
                      "
                    >
                      <button @click="startEdit(prop)" class="edit-btn">
                        Edit
                      </button>
                      <button
                        v-if="isSuperuser"
                        @click="deleteProperty(prop.id)"
                        class="delete-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="properties.length === 0">
                  <td colspan="8" class="empty-msg">No properties found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- BLOG MANAGEMENT -->

      <div v-if="activeTab === 'blogs'" class="tab-content">
        <!-- Header row -->
        <div class="tab-header-row">
          <h1 class="tab-title">{{ showBlogForm ? (isEditingBlog ? 'Edit Blog Post' : 'Add New Blog Post') : 'Blog Posts' }}</h1>
          <button 
            v-if="!showBlogForm" 
            @click="startAddBlog" 
            class="action-header-btn"
          >
            <span class="material-icons-outlined">add</span>
            Add New Post
          </button>
          <button 
            v-else 
            @click="cancelEditBlog" 
            class="action-header-btn secondary-btn"
          >
            <span class="material-icons-outlined">arrow_back</span>
            Back to List
          </button>
        </div>

        <!-- Add/Edit Blog Form -->
        <section
          v-if="showBlogForm"
          class="admin-section card"
          :class="{ 'edit-mode': isEditingBlog }"
        >
          <form
            @submit.prevent="isEditingBlog ? updateBlogPost() : addBlogPost()"
            class="admin-form"
          >
            <div class="form-grid">
              <!-- Slug field removed as it's auto-generated -->

              <!-- Title Multi-lang -->
              <div class="form-field full-width">
                <div class="description-header">
                  <label>Title</label>
                  <div class="lang-tabs">
                    <button
                      type="button"
                      class="lang-tab"
                      :class="{ active: descriptionTab === 'en' }"
                      @click="descriptionTab = 'en'"
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      class="lang-tab"
                      :class="{ active: descriptionTab === 'fr' }"
                      @click="descriptionTab = 'fr'"
                    >
                      FR
                    </button>
                    <button
                      type="button"
                      class="lang-tab"
                      :class="{ active: descriptionTab === 'tr' }"
                      @click="descriptionTab = 'tr'"
                    >
                      TR
                    </button>
                  </div>
                </div>
                <input
                  v-if="descriptionTab === 'en'"
                  v-model="newBlogPost.title_en"
                  type="text"
                  required
                  placeholder="English title"
                />
                <input
                  v-else-if="descriptionTab === 'fr'"
                  v-model="newBlogPost.title_fr"
                  type="text"
                  placeholder="French title"
                />
                <input
                  v-else-if="descriptionTab === 'tr'"
                  v-model="newBlogPost.title_tr"
                  type="text"
                  placeholder="Turkish title"
                />
              </div>

              <!-- Content Multi-lang -->
              <div class="form-field full-width">
                <label>Content</label>
                <div class="quill-wrapper">
                  <QuillEditor
                    v-if="descriptionTab === 'en'"
                    :content="newBlogPost.content_en"
                    @update:content="(v) => (newBlogPost.content_en = v)"
                    contentType="html"
                    theme="snow"
                    :toolbar="toolbarOptions"
                    placeholder="English content..."
                  />
                  <QuillEditor
                    v-else-if="descriptionTab === 'fr'"
                    :content="newBlogPost.content_fr"
                    @update:content="(v) => (newBlogPost.content_fr = v)"
                    contentType="html"
                    theme="snow"
                    :toolbar="toolbarOptions"
                    placeholder="French content..."
                  />
                  <QuillEditor
                    v-else-if="descriptionTab === 'tr'"
                    :content="newBlogPost.content_tr"
                    @update:content="(v) => (newBlogPost.content_tr = v)"
                    contentType="html"
                    theme="snow"
                    :toolbar="toolbarOptions"
                    placeholder="Turkish content..."
                  />
                </div>
              </div>

              <!-- Excerpt Multi-lang -->
              <div class="form-field full-width">
                <label>Excerpt (Summary)</label>
                <input
                  v-if="descriptionTab === 'en'"
                  v-model="newBlogPost.excerpt_en"
                  type="text"
                  placeholder="English excerpt"
                />
                <input
                  v-else-if="descriptionTab === 'fr'"
                  v-model="newBlogPost.excerpt_fr"
                  type="text"
                  placeholder="French excerpt"
                />
                <input
                  v-else-if="descriptionTab === 'tr'"
                  v-model="newBlogPost.excerpt_tr"
                  type="text"
                  placeholder="Turkish excerpt"
                />
              </div>

              <!-- Image Section -->
              <div class="form-field full-width">
                <label>Featured Image</label>
                <div class="upload-trigger">
                  <input
                    type="file"
                    accept="image/*"
                    @change="handleBlogImageUpload"
                    id="blog-image-upload"
                    class="file-input"
                  />
                  <label for="blog-image-upload" class="upload-btn">
                    <span class="material-icons-outlined">image</span>
                    {{ isUploading ? "Uploading..." : "Upload Image" }}
                  </label>
                </div>
                <div v-if="newBlogPost.image_url" class="media-previews">
                  <div class="preview-item">
                    <img :src="newBlogPost.image_url" alt="Blog Preview" />
                    <button
                      type="button"
                      @click="newBlogPost.image_url = ''"
                      class="remove-media"
                    >
                      <span class="material-icons-outlined">close</span>
                    </button>
                  </div>
                </div>
              </div>

              <div class="form-field">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="newBlogPost.is_published" />
                  Published
                </label>
              </div>
            </div>

            <div
              class="form-actions"
              style="margin-top: 2rem; display: flex; gap: 1rem"
            >
              <button type="submit" class="submit-btn" :disabled="isUploading">
                {{ isEditingBlog ? "Save Post" : "Add Post" }}
              </button>
              <button
                v-if="isEditingBlog"
                type="button"
                @click="cancelEditBlog"
                class="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>

        <!-- Blog list table -->
        <section v-else class="admin-section card">
          <h2 class="section-subtitle">Manage Blog Posts</h2>
          <div class="property-list">
            <table>
              <thead>
                <tr>
                  <th>Title (EN)</th>
                  <th>Author</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Approval</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="post in blogPosts" :key="post.id">
                  <td>{{ post.title_en }}</td>
                  <td>
                    <span
                      v-if="post.author"
                      class="text-muted"
                      style="font-size: 0.85rem"
                    >
                      {{ post.author.full_name || post.author.email }}
                    </span>
                  </td>
                  <td>
                    {{ new Date(post.published_at).toLocaleDateString() }}
                  </td>
                  <td>
                    <span
                      class="status-pill"
                      :class="post.is_published ? 'active' : 'sold'"
                    >
                      {{ post.is_published ? "Published" : "Draft" }}
                    </span>
                  </td>
                  <td>
                    <span
                      v-if="post.is_approved"
                      class="status-pill active"
                      style="background-color: #dcfce7; color: #166534"
                    >
                      Approved
                    </span>
                    <span
                      v-else
                      class="status-pill sold"
                      style="background-color: #fee2e2; color: #991b1b"
                    >
                      Pending
                    </span>
                  </td>
                  <td>
                    <div
                      style="
                        display: flex;
                        gap: 0.5rem;
                        align-items: center;
                        flex-wrap: nowrap;
                      "
                    >
                      <button
                        v-if="isSuperuser && !post.is_approved"
                        @click="approveBlogPost(post.id)"
                        class="edit-btn"
                        style="
                          background-color: #166534;
                          border-color: #166534;
                          color: white;
                        "
                      >
                        Approve
                      </button>
                      <button
                        v-if="canManagePost(post)"
                        @click="startEditBlog(post)"
                        class="edit-btn"
                      >
                        Edit
                      </button>
                      <button
                        v-if="canManagePost(post)"
                        @click="deleteBlogPost(post.id)"
                        class="delete-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="blogPosts.length === 0">
                  <td colspan="6" class="empty-msg">No blog posts found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- USER MANAGEMENT -->
      <div v-if="activeTab === 'users' && isSuperuser" class="tab-content">
        <section class="admin-section card">
          <h2 class="section-subtitle">Password Reset Requests</h2>
          <div class="property-list">
            <table>
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>Requested At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="req in passwordResets" :key="req.id">
                  <td>{{ req.user.email }}</td>
                  <td>{{ new Date(req.created_at).toLocaleDateString() }}</td>
                  <td>
                    <button
                      @click="approvePasswordReset(req.id)"
                      class="action-btn publish-btn"
                      style="background: #f2cd13; color: #002a35"
                    >
                      Approve Reset
                    </button>
                  </td>
                </tr>
                <tr v-if="passwordResets.length === 0">
                  <td colspan="3" class="empty-msg">No pending requests.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-section card">
          <h2 class="section-subtitle">Create New Admin User</h2>
          <form @submit.prevent="createAdminUser" class="admin-form">
            <div class="form-grid">
              <div class="form-field">
                <label>Full Name</label>
                <input v-model="newUser.full_name" type="text" required />
              </div>
              <div class="form-field">
                <label>Email</label>
                <input v-model="newUser.email" type="email" required />
              </div>
              <div class="form-field">
                <label>Role</label>
                <select v-model="newUser.role">
                  <option value="superuser">Superuser</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
            </div>
            <p
              class="instruction-text"
              style="color: var(--accent); margin-top: 1rem; font-size: 0.9rem"
            >
              The new user's password will be set to
              <strong>Servet1965!</strong> automatically. They will be forced to
              change it on their first login.
            </p>
            <button type="submit" class="submit-btn" style="margin-top: 1rem">
              Create User
            </button>
          </form>
        </section>

        <section class="admin-section card">
          <h2 class="section-subtitle">System Users</h2>
          <div class="property-list">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user.id">
                  <td>{{ user.full_name }}</td>
                  <td>{{ user.email }}</td>
                  <td>
                    <span class="role-badge" :class="user.role">{{
                      user.role
                    }}</span>
                  </td>
                  <td>
                    <button
                      v-if="user.email !== currentUserEmail"
                      @click="deleteAdminUser(user.id, user.email)"
                      class="delete-btn"
                    >
                      Delete
                    </button>
                    <span v-else class="current-user-tag">(You)</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <!-- BUYER MANAGEMENT (Superuser Only) -->
        <section
          v-if="isSuperuser"
          class="admin-section card"
          style="margin-top: 2rem"
        >
          <h2 class="section-subtitle">Buyer Management</h2>
          <form
            @submit.prevent="addBuyer"
            class="admin-form"
            style="margin-bottom: 2rem"
          >
            <div class="form-grid">
              <div class="form-field">
                <label>Full Name</label>
                <input
                  v-model="newBuyer.full_name"
                  type="text"
                  required
                  placeholder="John Doe"
                />
              </div>
              <div class="form-field">
                <label>Email</label>
                <input
                  v-model="newBuyer.email"
                  type="email"
                  required
                  placeholder="john@example.com"
                />
              </div>
              <div class="form-field">
                <label>Phone</label>
                <input
                  v-model="newBuyer.phone"
                  type="text"
                  placeholder="+33..."
                />
              </div>
            </div>
            <div class="form-actions" style="margin-top: 1rem">
              <button
                type="submit"
                class="submit-btn"
                style="width: auto; padding: 0.8rem 2rem"
              >
                Add Buyer
              </button>
            </div>
          </form>

          <div class="table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="buyer in buyers" :key="buyer.id">
                  <td>{{ buyer.full_name }}</td>
                  <td>{{ buyer.email }}</td>
                  <td>{{ buyer.phone || "-" }}</td>
                  <td>
                    <button @click="deleteBuyer(buyer.id)" class="delete-btn">
                      Remove
                    </button>
                  </td>
                </tr>
                <tr v-if="buyers.length === 0">
                  <td colspan="4" class="empty-msg">No buyers found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- TAG MANAGEMENT -->
        <section class="admin-section card" style="margin-top: 2rem">
          <h2 class="section-subtitle">Manage Research Tags</h2>
          <div style="display: flex; gap: 1rem; margin-bottom: 2rem">
            <input
              v-model="newTagName"
              type="text"
              placeholder="New tag name..."
              class="filter-input"
              style="
                padding: 0.6rem 1rem;
                border-radius: 8px;
                border: 1px solid #eee;
                flex: 1;
              "
            />
            <button
              @click="addResearchTag"
              class="submit-btn"
              style="width: auto; padding: 0.6rem 2rem"
            >
              Add Tag
            </button>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 1rem">
            <div
              v-for="tag in tags"
              :key="tag.id"
              style="
                display: flex;
                align-items: center;
                gap: 0.8rem;
                padding: 0.6rem 1rem;
                background: #f0fdf4;
                border: 1px solid #dcfce7;
                border-radius: 30px;
                color: #166534;
                font-weight: 500;
              "
            >
              {{ tag.name }}
              <button
                @click="deleteResearchTag(tag.id)"
                style="
                  border: none;
                  background: none;
                  color: #991b1b;
                  cursor: pointer;
                  font-weight: bold;
                  font-size: 1.2rem;
                  line-height: 1;
                "
              >
                &times;
              </button>
            </div>
            <div v-if="tags.length === 0" class="text-muted">
              No tags created yet.
            </div>
          </div>
        </section>
      </div>

      <!-- RESEARCH FILTER MODAL -->
      <Transition name="fade">
        <div
          v-if="showResearchFilterModal"
          class="modal-overlay"
          @click.self="showResearchFilterModal = false"
        >
          <div class="modal-content filter-modal">
            <div class="modal-header">
              <h3>Advanced Filtering</h3>
              <button
                @click="showResearchFilterModal = false"
                class="close-btn"
              >
                &times;
              </button>
            </div>

            <div class="filter-modal-body">
              <!-- Price Range -->
              <div class="filter-group">
                <label>Price Range (€)</label>
                <div class="range-inputs">
                  <input
                    v-model.number="researchFilters.minPrice"
                    type="number"
                    placeholder="Min"
                  />
                  <input
                    v-model.number="researchFilters.maxPrice"
                    type="number"
                    placeholder="Max"
                  />
                </div>
              </div>

              <!-- Area Range -->
              <div class="filter-group">
                <label>Area Range (m²)</label>
                <div class="range-inputs">
                  <input
                    v-model.number="researchFilters.minArea"
                    type="number"
                    placeholder="Min"
                  />
                  <input
                    v-model.number="researchFilters.maxArea"
                    type="number"
                    placeholder="Max"
                  />
                </div>
              </div>

              <!-- Price/m2 Range -->
              <div class="filter-group">
                <label>Price per m² Range (€/m²)</label>
                <div class="range-inputs">
                  <input
                    v-model.number="researchFilters.minPricePerSqm"
                    type="number"
                    placeholder="Min"
                  />
                  <input
                    v-model.number="researchFilters.maxPricePerSqm"
                    type="number"
                    placeholder="Max"
                  />
                </div>
              </div>

              <!-- Rooms Range -->
              <div class="filter-group">
                <label>Rooms Range</label>
                <div class="range-inputs">
                  <input
                    v-model.number="researchFilters.minRooms"
                    type="number"
                    placeholder="Min"
                  />
                  <input
                    v-model.number="researchFilters.maxRooms"
                    type="number"
                    placeholder="Max"
                  />
                </div>
              </div>

              <!-- Multi-select Buyers -->
              <div class="filter-group">
                <label>Buyers (Select Multiple)</label>
                <div class="multi-select-box">
                  <!-- Special Pool Option -->
                  <label
                    class="multi-select-item"
                    style="background: #fff7ed; border: 1px solid #ffedd5"
                  >
                    <input
                      type="checkbox"
                      v-model="researchFilters.buyerIds"
                      :value="null"
                    />
                    <span style="color: #9a3412; font-weight: 600"
                      >Pool (Unassigned)</span
                    >
                  </label>

                  <label
                    v-for="buyer in buyers"
                    :key="buyer.id"
                    class="multi-select-item"
                  >
                    <input
                      type="checkbox"
                      v-model="researchFilters.buyerIds"
                      :value="buyer.id"
                    />
                    {{ buyer.full_name }}
                  </label>
                </div>
              </div>

              <!-- Date Range -->
              <div class="filter-group">
                <label>Date Range (Added)</label>
                <div class="range-inputs">
                  <input
                    v-model="researchFilters.startDate"
                    type="date"
                    placeholder="Start Date"
                  />
                  <input
                    v-model="researchFilters.endDate"
                    type="date"
                    placeholder="End Date"
                  />
                </div>
              </div>

              <!-- Multi-select Tags -->

              <div class="filter-group">
                <label>Tags (Select Multiple)</label>
                <div class="multi-select-box">
                  <label
                    v-for="tag in tags"
                    :key="tag.id"
                    class="multi-select-item"
                  >
                    <input
                      type="checkbox"
                      v-model="researchFilters.tagIds"
                      :value="tag.id"
                    />
                    {{ tag.name }}
                  </label>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="resetResearchFilters" class="reset-btn">
                Reset All
              </button>
              <button
                @click="showResearchFilterModal = false"
                class="apply-btn"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- PROFILE SETTINGS -->

      <div v-if="activeTab === 'profile'" class="tab-content">
        <section class="admin-section card">
          <h2 class="section-subtitle">Account Settings</h2>
          <div style="max-width: 500px">
            <p style="margin-bottom: 2rem; color: var(--accent)">
              Update your password here. You will need to enter your current
              password to make this change.
            </p>
            <form @submit.prevent="changeMyPassword" class="admin-form">
              <div
                class="form-grid"
                style="grid-template-columns: 1fr; gap: 1rem"
              >
                <div class="form-field">
                  <label>Current Password</label>
                  <input
                    v-model="profilePassword.old_password"
                    type="password"
                    required
                    placeholder="Enter current password"
                  />
                </div>
                <div class="form-field">
                  <label>New Password</label>
                  <input
                    v-model="profilePassword.new_password"
                    type="password"
                    required
                    placeholder="Enter new password"
                  />
                </div>
                <div class="form-field">
                  <label>Confirm New Password</label>
                  <input
                    v-model="profilePassword.confirm_password"
                    type="password"
                    required
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <button type="submit" class="submit-btn" style="margin-top: 2rem">
                Update Password
              </button>
            </form>
          </div>
        </section>
      </div>

      <!-- CONTACT MESSAGES -->
      <div v-if="activeTab === 'messages'" class="tab-content">
        <section class="admin-section card">
          <h2 class="section-subtitle">Contact Messages</h2>
          <div class="property-list">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Context</th>
                  <th>Message</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="msg in contactMessages" :key="msg.id">
                  <td>
                    <span
                      class="status-pill"
                      :class="msg.is_read ? 'active' : 'sold'"
                    >
                      {{ msg.is_read ? "Read" : "Unread" }}
                    </span>
                  </td>
                  <td>{{ new Date(msg.created_at).toLocaleDateString() }}</td>
                  <td>
                    <strong>{{ msg.name }}</strong
                    ><br />
                    <small class="text-muted">{{ msg.email }}</small
                    ><br />
                    <small class="text-muted" v-if="msg.phone">{{
                      msg.phone
                    }}</small>
                  </td>
                  <td>
                    <span v-if="msg.property_title">{{
                      msg.property_title
                    }}</span>
                    <span v-else class="text-muted">General Contact</span>
                  </td>
                  <td style="max-width: 300px">
                    <div
                      style="
                        max-height: 100px;
                        overflow-y: auto;
                        font-size: 0.9em;
                        white-space: pre-wrap;
                      "
                    >
                      {{ msg.message }}
                    </div>
                  </td>
                  <td>
                    <div
                      style="
                        display: flex;
                        gap: 0.5rem;
                        align-items: center;
                        flex-wrap: nowrap;
                      "
                    >
                      <button
                        v-if="!msg.is_read"
                        @click="markMessageAsRead(msg.id, true)"
                        class="edit-btn"
                        style="
                          background-color: #166534;
                          border-color: #166534;
                          color: white;
                        "
                      >
                        Mark Read
                      </button>
                      <button
                        v-else
                        @click="markMessageAsRead(msg.id, false)"
                        class="edit-btn"
                      >
                        Mark Unread
                      </button>
                      <button
                        v-if="isSuperuser"
                        @click="deleteContactMessage(msg.id)"
                        class="delete-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="contactMessages.length === 0">
                  <td colspan="6" class="empty-msg">No messages found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- RESEARCH MANAGEMENT -->
      <div v-if="activeTab === 'research'" class="tab-content">
        <!-- Header row -->
        <div class="tab-header-row">
          <h1 class="tab-title">{{ showResearchForm ? (isEditingResearch ? 'Edit Research Property' : 'Add Research Property') : 'Research' }}</h1>
          <button 
            v-if="!showResearchForm" 
            @click="startAddResearch" 
            class="action-header-btn"
          >
            <span class="material-icons-outlined">add</span>
            Add to Research
          </button>
          <button 
            v-else 
            @click="cancelEditResearch" 
            class="action-header-btn secondary-btn"
          >
            <span class="material-icons-outlined">arrow_back</span>
            Back to List
          </button>
        </div>

        <div
          v-if="!showResearchForm"
          class="research-type-tabs"
          style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem"
        >
          <button
            v-for="tab in researchTypeTabs"
            :key="tab.value"
            type="button"
            @click="researchSubTab = tab.value"
            class="action-btn"
            :style="[
              researchSubTab === tab.value
                ? { background: 'var(--primary)', color: 'var(--accent)', border: '1px solid var(--primary)' }
                : { background: '#fff', color: 'var(--primary)', border: '1px solid #eee' },
              { padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }
            ]"
          >
            {{ tab.label }}
          </button>
        </div>

        <section
          v-if="showResearchForm"
          class="admin-section card"
          :class="{ 'edit-mode': isEditingResearch }"
        >
          <form
            @submit.prevent="
              isEditingResearch ? updateResearchListing() : addResearchListing()
            "
            class="admin-form"
          >
            <div class="form-grid">
              <div class="form-field full-width">
                <label>URL</label>
                <input
                  v-model="newResearch.url"
                  type="url"
                  required
                  placeholder="https://..."
                />
              </div>
              <div class="form-field">
                <label>Price (€)</label>
                <input
                  v-model.number="newResearch.price"
                  type="number"
                  required
                />
              </div>
              <div class="form-field">
                <label>Area (m²)</label>
                <input
                  v-model.number="newResearch.square_meters"
                  type="number"
                  required
                />
              </div>
              <div v-if="isApartmentResearchType" class="form-field">
                <label>Pièces</label>
                <input
                  v-model.number="newResearch.rooms"
                  type="number"
                  required
                />
              </div>
              <div class="form-field">
                <label>Buyer (Optional)</label>
                <select v-model="newResearch.buyer_id">
                  <option :value="null">Pool</option>
                  <option
                    v-for="buyer in buyers"
                    :key="buyer.id"
                    :value="buyer.id"
                  >
                    {{ buyer.full_name }}
                  </option>
                </select>
              </div>

              <div v-if="isApartmentResearchType" class="form-field">
                <label>Neighborhood (Mahalle)</label>
                <input
                  v-model="newResearch.neighborhood"
                  type="text"
                  required
                  placeholder="Paris 5"
                />
              </div>
              <div v-if="isApartmentResearchType" class="form-field">
                <label>Zip Code (Posta Kodu)</label>
                <input
                  v-model="newResearch.zip_code"
                  type="text"
                  required
                  placeholder="75005"
                />
              </div>
              <div v-if="isApartmentResearchType" class="form-field">
                <label>Address</label>
                <input v-model="newResearch.address" type="text" />
              </div>

              <div v-if="isApartmentResearchType" class="form-field">
                <label>DPE No</label>
                <select v-model="newResearch.dpe">
                  <option
                    v-for="c in ['A', 'B', 'C', 'D', 'E', 'F', 'G']"
                    :key="c"
                    :value="c"
                  >
                    {{ c }}
                  </option>
                </select>
              </div>

              <div v-if="isApartmentResearchType" class="form-field">
                <label>Floor (Kat)</label>
                <input
                  v-model.number="newResearch.floor"
                  type="number"
                  placeholder="e.g. 2"
                />
              </div>
              <div v-if="isApartmentResearchType" class="form-field">
                <label>Total Floors (Toplam Kat)</label>
                <input
                  v-model.number="newResearch.total_floors"
                  type="number"
                  placeholder="e.g. 5"
                />
              </div>

              <div v-if="isApartmentResearchType" class="form-field">
                <label>Heating System</label>

                <select v-model="newResearch.heating_system">
                  <option value="Electric">Electric</option>
                  <option value="Gas">Gas</option>
                </select>
              </div>

              <div class="form-field full-width">
                <label>Tags (Select Multiple)</label>
                <div
                  style="
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    padding: 0.5rem;
                    border: 1px solid #eee;
                    border-radius: 8px;
                    background: #fff;
                  "
                >
                  <label
                    v-for="tag in tags"
                    :key="tag.id"
                    style="
                      display: flex;
                      align-items: center;
                      gap: 0.5rem;
                      cursor: pointer;
                      padding: 4px 8px;
                      background: #f9f9f9;
                      border-radius: 4px;
                      font-size: 0.85rem;
                    "
                  >
                    <input
                      type="checkbox"
                      v-model="newResearch.tag_ids"
                      :value="tag.id"
                    />
                    {{ tag.name }}
                  </label>
                  <div v-if="tags.length === 0" class="text-muted small">
                    No tags defined.
                  </div>
                </div>
              </div>

              <div
                v-if="isApartmentResearchType"
                class="form-field checkboxes"
                style="
                  grid-column: span 2;
                  display: flex;
                  gap: 2rem;
                  margin-top: 1rem;
                "
              >
                <label
                  class="checkbox-label"
                  style="
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                  "
                >
                  <input type="checkbox" v-model="newResearch.has_balcony" />
                  Balcony
                </label>
                <label
                  class="checkbox-label"
                  style="
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                  "
                >
                  <input type="checkbox" v-model="newResearch.has_parking" />
                  Parking
                </label>
                <label
                  class="checkbox-label"
                  style="
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                  "
                >
                  <input type="checkbox" v-model="newResearch.has_garden" />
                  Garden
                </label>
                <label
                  class="checkbox-label"
                  style="
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                  "
                >
                  <input type="checkbox" v-model="newResearch.has_elevator" />
                  Elevator
                </label>
              </div>

              <div class="form-field full-width">
                <label
                  >Internal Notes / Comments (Shown on PDF report)
                  <span
                    v-if="newResearch.internal_notes"
                    style="color: green; font-size: 0.7rem"
                    >(Data Loaded)</span
                  ></label
                >
                <textarea
                  v-model="newResearch.internal_notes"
                  placeholder="Enter internal comments about this property..."
                  style="
                    width: 100%;
                    border-radius: 8px;
                    border: 1px solid #eee;
                    padding: 0.75rem;
                    min-height: 80px;
                    font-family: inherit;
                  "
                ></textarea>
              </div>
            </div>

            <div
              class="form-actions"
              style="margin-top: 1rem; display: flex; gap: 1rem"
            >
              <button type="submit" class="submit-btn" :disabled="isUploading">
                {{ isEditingResearch ? "Update Property" : "Add to Research" }}
              </button>

              <button
                v-if="isEditingResearch"
                type="button"
                @click="cancelEditResearch"
                class="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>

        <section v-else class="admin-section card">
          <div
            class="section-header-row"
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 2rem;
            "
          >
            <h2 class="section-subtitle" style="margin-bottom: 0">
              Research List
            </h2>

            <!-- Filter Bar -->
            <div
              class="research-filters"
              style="display: flex; gap: 0.5rem; align-items: center"
            >
              <div class="filter-field">
                <input
                  v-model="researchSearchQuery"
                  type="text"
                  placeholder="Quick Search"
                  class="filter-input"
                  style="
                    padding: 0.5rem 0.75rem;
                    border-radius: 8px;
                    border: 1px solid #eee;
                    width: 200px;
                    font-size: 0.85rem;
                  "
                />
              </div>

              <button
                @click="showResearchFilterModal = true"
                class="action-btn"
                style="
                  padding: 0.5rem;
                  background: #fff;
                  color: var(--primary);
                  border: 1px solid #eee;
                  border-radius: 8px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                "
                title="Advanced Filters"
              >
                <span class="material-icons-outlined">tune</span>
              </button>

              <button
                @click="exportToExcel"
                class="action-btn"
                style="
                  padding: 0.5rem 0.75rem;
                  background: #166534;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  font-size: 0.85rem;
                  white-space: nowrap;
                "
              >
                <span class="material-icons-outlined" style="font-size: 16px"
                  >download</span
                >
                Export
              </button>

              <div class="items-per-page" style="margin-left: 0.5rem">
                <select
                  v-model="researchItemsPerPage"
                  style="
                    padding: 0.5rem;
                    border-radius: 8px;
                    border: 1px solid #eee;
                    font-size: 0.85rem;
                    background: white;
                    cursor: pointer;
                  "
                >
                  <option :value="10">10 / sayfa</option>
                  <option :value="50">50 / sayfa</option>
                  <option :value="100">100 / sayfa</option>
                </select>
              </div>
            </div>
          </div>

          <div class="property-list">
            <table>
              <thead>
                <tr>
                  <th
                    @click="toggleResearchSort('price')"
                    style="cursor: pointer"
                  >
                    Price
                    <span v-if="researchSortKey === 'price'">{{
                      researchSortOrder === "asc" ? "↑" : "↓"
                    }}</span>
                  </th>
                  <th
                    @click="toggleResearchSort('square_meters')"
                    style="cursor: pointer"
                  >
                    m²
                    <span v-if="researchSortKey === 'square_meters'">{{
                      researchSortOrder === "asc" ? "↑" : "↓"
                    }}</span>
                  </th>
                  <th
                    @click="toggleResearchSort('price_per_sqm')"
                    style="cursor: pointer"
                  >
                    €/m²
                    <span v-if="researchSortKey === 'price_per_sqm'">{{
                      researchSortOrder === "asc" ? "↑" : "↓"
                    }}</span>
                  </th>
                  <th
                    @click="toggleResearchSort('rooms')"
                    style="cursor: pointer"
                  >
                    Rooms
                    <span v-if="researchSortKey === 'rooms'">{{
                      researchSortOrder === "asc" ? "↑" : "↓"
                    }}</span>
                  </th>
                  <th>Location</th>
                  <th>Buyer</th>
                  <th
                    @click="toggleResearchSort('created_at')"
                    style="cursor: pointer"
                  >
                    Added
                    <span v-if="researchSortKey === 'created_at'">{{
                      researchSortOrder === "asc" ? "↑" : "↓"
                    }}</span>
                  </th>
                  <th>Link</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="item in paginatedResearchListings" :key="item.id">
                  <td>€{{ Number(item.price).toLocaleString() }}</td>
                  <td>{{ item.square_meters }}m²</td>
                  <td>
                    €{{
                      item.price_per_sqm
                        ? Number(item.price_per_sqm).toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })
                        : "-"
                    }}
                  </td>
                  <td>{{ item.rooms }}</td>

                  <td>
                    <strong>{{ item.neighborhood }}</strong
                    ><br />
                    <small>{{ item.zip_code }}</small>
                  </td>
                  <td style="font-size: 0.85rem">
                    <div
                      v-if="item.buyer"
                      style="color: var(--primary); font-weight: 500"
                    >
                      {{ item.buyer.full_name }}
                    </div>
                    <div
                      v-else
                      style="
                        color: #9a3412;
                        font-weight: 600;
                        font-size: 0.75rem;
                        background: #fff7ed;
                        padding: 2px 6px;
                        border-radius: 4px;
                        display: inline-block;
                      "
                    >
                      POOL
                    </div>
                  </td>

                  <td style="font-size: 0.8rem">
                    {{ new Date(item.created_at).toLocaleDateString() }}
                  </td>

                  <td>
                    <a
                      :href="item.url"
                      target="_blank"
                      class="text-link"
                      style="color: var(--primary); text-decoration: underline"
                      >View</a
                    >
                  </td>

                  <td>
                    <div
                      style="
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                        min-width: 80px;
                      "
                    >
                      <button
                        @click="startEditResearch(item)"
                        class="edit-btn"
                        style="
                          padding: 4px 8px;
                          font-size: 0.75rem;
                          width: 100%;
                        "
                      >
                        Edit
                      </button>
                      <button
                        v-if="isSuperuser"
                        @click="deleteResearchListing(item.id)"
                        class="delete-btn"
                        style="
                          padding: 4px 8px;
                          font-size: 0.75rem;
                          width: 100%;
                        "
                      >
                        Delete
                      </button>
                      <span
                        v-if="!isSuperuser"
                        class="no-perms"
                        style="
                          font-size: 0.65rem;
                          white-space: nowrap;
                          text-align: center;
                          color: #999;
                        "
                      >
                        Read-Only
                      </span>
                    </div>
                  </td>
                </tr>

                <tr v-if="paginatedResearchListings.length === 0">
                  <td colspan="9" class="empty-msg">
                    No research properties found.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Controls -->
          <div v-if="researchTotalPages > 1" class="pagination-wrapper" style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #f3f4f6;">
            <button 
              @click="researchCurrentPage--" 
              :disabled="researchCurrentPage === 1"
              class="pagination-btn"
              style="padding: 0.5rem 1rem; border: 1px solid #eee; background: white; border-radius: 6px; cursor: pointer; transition: all 0.2s;"
              :style="researchCurrentPage === 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''"
            >
              Previous
            </button>
            
            <div class="page-numbers" style="display: flex; gap: 0.25rem;">
              <button 
                v-for="p in researchTotalPages" 
                :key="p"
                @click="researchCurrentPage = p"
                class="pagination-btn"
                style="min-width: 38px; padding: 0.5rem; border: 1px solid #eee; background: white; border-radius: 6px; cursor: pointer; transition: all 0.2s;"
                :style="researchCurrentPage === p ? 'background: var(--primary); color: var(--accent); border-color: var(--primary); font-weight: 700;' : ''"
              >
                {{ p }}
              </button>
            </div>

            <button 
              @click="researchCurrentPage++" 
              :disabled="researchCurrentPage === researchTotalPages"
              class="pagination-btn"
              style="padding: 0.5rem 1rem; border: 1px solid #eee; background: white; border-radius: 6px; cursor: pointer; transition: all 0.2s;"
              :style="researchCurrentPage === researchTotalPages ? 'opacity: 0.5; cursor: not-allowed;' : ''"
            >
              Next
            </button>
          </div>
        </section>
      </div>

      <!-- CONCIERGE SERVICES MANAGEMENT -->
      <div v-if="activeTab === 'concierge'" class="tab-content">
        <!-- Header row -->
        <div class="tab-header-row" style="border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <h1 class="tab-title" style="margin: 0; font-size: 1.5rem; color: var(--primary);">
            Concierge Services
          </h1>
          <div style="display: flex; gap: 1rem;">
            <button 
              v-if="showConciergeForm" 
              @click="cancelEditConcierge" 
              class="action-header-btn secondary-btn"
            >
              <span class="material-icons-outlined">arrow_back</span>
              Cancel
            </button>
            <button 
              v-if="!showConciergeForm" 
              @click="startAddConcierge" 
              class="action-header-btn"
              style="background-color: var(--accent); color: var(--primary);"
            >
              <span class="material-icons-outlined">add</span>
              Add Property
            </button>
          </div>
        </div>

        <!-- Sub-navigation Bar (Under the Line) -->
        <div v-if="!showConciergeForm" style="display: flex; gap: 0.5rem; border-bottom: 1px solid #f3f4f6; padding-bottom: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: center;">
          <button 
            @click="currentConciergeView = 'dashboard'" 
            class="action-header-btn" 
            :style="currentConciergeView === 'dashboard' ? 'background: var(--primary); color: white;' : 'background: #f3f4f6; color: #475569;'"
          >
            <span class="material-icons-outlined" style="margin-right: 0.25rem;">dashboard</span>
            Dashboard
          </button>
          
          <button 
            @click="currentConciergeView = 'calendar'" 
            class="action-header-btn" 
            :style="currentConciergeView === 'calendar' ? 'background: var(--primary); color: white;' : 'background: #f3f4f6; color: #475569;'"
          >
            <span class="material-icons-outlined" style="margin-right: 0.25rem;">calendar_month</span>
            Timeline
          </button>
          
          <!-- Reservations Dropdown -->
          <div class="nav-dropdown-wrapper">
            <button 
              class="action-header-btn" 
              :style="['reservations-list', 'reports-tracking'].includes(currentConciergeView) ? 'background: var(--primary); color: white;' : 'background: #f3f4f6; color: #475569;'"
            >
              <span class="material-icons-outlined" style="margin-right: 0.25rem;">book_online</span>
              Reservations
              <span class="material-icons-outlined" style="font-size: 1rem; margin-left: 0.25rem;">expand_more</span>
            </button>
            <div class="nav-dropdown-menu">
              <a 
                @click="currentConciergeView = 'reservations-list'"
                :class="{ active: currentConciergeView === 'reservations-list' }"
              >
                <span class="material-icons-outlined">list_alt</span>
                Reservations List
              </a>
              <a 
                @click="openQuickBooking"
              >
                <span class="material-icons-outlined">add_circle_outline</span>
                Add Reservation
              </a>
              <a 
                @click="currentConciergeView = 'reports-tracking'"
                :class="{ active: currentConciergeView === 'reports-tracking' }"
              >
                <span class="material-icons-outlined">mail_outline</span>
                Reports Tracking
              </a>
            </div>
          </div>

          <!-- Cleaning Dropdown -->
          <div class="nav-dropdown-wrapper">
            <button 
              class="action-header-btn" 
              :style="['cleaning', 'cleaning-report', (isSuperuser ? 'cleaner-payments' : '')].includes(currentConciergeView) ? 'background: var(--primary); color: white;' : 'background: #f3f4f6; color: #475569;'"
            >
              <span class="material-icons-outlined" style="margin-right: 0.25rem;">cleaning_services</span>
              Cleaning
              <span class="material-icons-outlined" style="font-size: 1rem; margin-left: 0.25rem;">expand_more</span>
            </button>
            <div class="nav-dropdown-menu">
              <a 
                @click="currentConciergeView = 'cleaning'"
                :class="{ active: currentConciergeView === 'cleaning' }"
              >
                <span class="material-icons-outlined">schedule</span>
                Cleaning Schedule
              </a>
              <a 
                @click="currentConciergeView = 'cleaning-report'; fetchReportCleaningAssignments(); fetchCleanerTransactions();"
                :class="{ active: currentConciergeView === 'cleaning-report' }"
              >
                <span class="material-icons-outlined">summarize</span>
                Cleaning Report
              </a>
              <a 
                v-if="isSuperuser"
                @click="currentConciergeView = 'cleaner-payments'; fetchReportCleaningAssignments(); fetchCleanerTransactions();"
                :class="{ active: currentConciergeView === 'cleaner-payments' }"
              >
                <span class="material-icons-outlined">account_balance_wallet</span>
                Wage Payments
              </a>
            </div>
          </div>
        </div>

        <!-- Add/Edit Concierge Form -->
        <section v-if="showConciergeForm" class="admin-section card" :class="{ 'edit-mode': isEditingConcierge }">
          <form @submit.prevent="isEditingConcierge ? updateConciergeProperty() : addConciergeProperty()" class="admin-form">
            <div class="form-grid">
              <div class="form-field full-width">
                <label>Property Title / Name</label>
                <input v-model="newConcierge.title" type="text" required placeholder="e.g. Cozy Marais Apartment" />
              </div>

              <div class="form-field full-width">
                <label>Address</label>
                <input v-model="newConcierge.address" type="text" placeholder="e.g. 12 Rue des Rosiers, 75004 Paris" />
              </div>

              <div class="form-field">
                <label>Owner Name</label>
                <input v-model="newConcierge.owner_name" type="text" placeholder="e.g. John Doe" />
              </div>

              <div class="form-field">
                <label>Owner Email</label>
                <input v-model="newConcierge.owner_email" type="email" placeholder="e.g. owner@example.com" />
              </div>

              <div class="form-field">
                <label>Airbnb Cleaning Fee (€)</label>
                <input v-model.number="newConcierge.airbnb_cleaning_fee" type="number" min="0" step="0.01" placeholder="e.g. 65.00" />
              </div>

              <div class="form-field">
                <label>Max Cleaning Duration (hrs)</label>
                <input v-model.number="newConcierge.max_cleaning_duration" type="number" min="0" step="0.5" placeholder="e.g. 3" />
              </div>
            </div>
            <div class="form-actions" style="margin-top: 2rem; display: flex; gap: 1rem">
              <button type="submit" class="submit-btn">
                {{ isEditingConcierge ? "Save Changes" : "Add Property" }}
              </button>
              <button type="button" @click="cancelEditConcierge" class="cancel-btn">
                Cancel
              </button>
            </div>
          </form>
        </section>

        <!-- Concierge Performance Dashboard -->
        <div v-else-if="currentConciergeView === 'dashboard'" class="concierge-dashboard" style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Filters & Header Bar -->
          <div class="card" style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="material-icons-outlined" style="color: var(--primary); font-size: 1.5rem;">analytics</span>
              <span style="font-weight: 700; color: var(--primary); font-size: 1.1rem;">Dashboard Filters</span>
            </div>
            
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
              <!-- Property Dropdown -->
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-size: 0.8rem; font-weight: 700; color: #4b5563; text-transform: uppercase;">Property:</label>
                <select v-model="dashboardPropertyId" style="padding: 0.5rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; background: white; min-width: 180px;">
                  <option value="all">All Properties (Combined)</option>
                  <option v-for="p in conciergeProperties" :key="p.id" :value="p.id">{{ p.title }}</option>
                </select>
              </div>
              
              <!-- Year Dropdown -->
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-size: 0.8rem; font-weight: 700; color: #4b5563; text-transform: uppercase;">Year:</label>
                <select v-model="dashboardYear" style="padding: 0.5rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; background: white; min-width: 100px;">
                  <option v-for="yr in dashboardYears" :key="yr" :value="yr">{{ yr }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- KPI Cards Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem;">
            
            <!-- Avg Occupancy Rate -->
            <div class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); display: flex; align-items: center; gap: 1rem; position: relative; overflow: hidden;">
              <div style="background: #eff6ff; color: #2563eb; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <span class="material-icons-outlined" style="font-size: 1.5rem;">percent</span>
              </div>
              <div>
                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; display: block;">Avg Occupancy Rate</span>
                <strong style="font-size: 1.4rem; color: #0f172a; display: block; margin: 0.1rem 0;">{{ dashboardStats.avgOccupancy.toFixed(1) }}%</strong>
                <div style="width: 100%; background: #e2e8f0; height: 6px; border-radius: 3px; margin-top: 0.4rem; overflow: hidden;">
                  <div :style="{ width: dashboardStats.avgOccupancy + '%' }" style="background: #2563eb; height: 100%; border-radius: 3px; transition: width 0.6s ease;"></div>
                </div>
              </div>
            </div>

            <!-- Gross Revenue -->
            <div class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); display: flex; align-items: center; gap: 1rem;">
              <div style="background: #f0fdf4; color: #16a34a; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <span class="material-icons-outlined" style="font-size: 1.5rem;">payments</span>
              </div>
              <div>
                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; display: block;">Gross Revenue</span>
                <strong style="font-size: 1.4rem; color: #0f172a; display: block;">€{{ dashboardStats.totalGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</strong>
                <span style="font-size: 0.72rem; color: #6b7280; display: block; margin-top: 0.2rem;">Total gross listing price</span>
              </div>
            </div>

            <!-- Doorman Net Earnings -->
            <div class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); display: flex; align-items: center; gap: 1rem;">
              <div style="background: #fffbeb; color: #d97706; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <span class="material-icons-outlined" style="font-size: 1.5rem;">savings</span>
              </div>
              <div>
                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; display: block;">Doorman Payout</span>
                <strong style="font-size: 1.4rem; color: #0f172a; display: block;">€{{ dashboardStats.totalDoorman.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</strong>
                <span style="font-size: 0.72rem; color: #d97706; font-weight: 700; display: block; margin-top: 0.2rem;">Net commission share</span>
              </div>
            </div>

            <!-- Stays & Nights Count -->
            <div class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); display: flex; align-items: center; gap: 1rem;">
              <div style="background: #faf5ff; color: #7c3aed; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <span class="material-icons-outlined" style="font-size: 1.5rem;">hotel</span>
              </div>
              <div>
                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; display: block;">Bookings & Occupied</span>
                <strong style="font-size: 1.4rem; color: #0f172a; display: block;">{{ dashboardStats.totalBookings }} bookings</strong>
                <span style="font-size: 0.72rem; color: #6b7280; display: block; margin-top: 0.2rem;">{{ dashboardStats.totalOccupied }} occupied nights / {{ dashboardStats.totalBlocked }} blocked</span>
              </div>
            </div>

          </div>

          <!-- Charts Section Grid -->
          <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
            
            <!-- Chart 1: Occupancy Rate Trend Line Chart -->
            <div class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
              <h3 style="font-size: 1rem; color: var(--primary); font-weight: 700; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
                <span class="material-icons-outlined" style="color: #2563eb;">trending_up</span>
                Monthly Occupancy Trend ({{ dashboardYear }})
              </h3>
              
              <!-- SVG Graph wrapper -->
              <div style="width: 100%; overflow-x: auto; padding-bottom: 0.5rem;">
                <svg viewBox="0 0 1000 320" style="width: 100%; min-width: 800px; height: auto; display: block;">
                  <!-- Definitions for Gradients -->
                  <defs>
                    <linearGradient id="occupancyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.25" />
                      <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  <!-- Y-Axis Grid Lines & Labels -->
                  <g stroke="#f1f5f9" stroke-width="1">
                    <!-- 100% -->
                    <line x1="60" y1="40" x2="960" y2="40" />
                    <!-- 75% -->
                    <line x1="60" y1="100" x2="960" y2="100" />
                    <!-- 50% -->
                    <line x1="60" y1="160" x2="960" y2="160" />
                    <!-- 25% -->
                    <line x1="60" y1="220" x2="960" y2="220" />
                    <!-- 0% -->
                    <line x1="60" y1="280" x2="960" y2="280" stroke="#cbd5e1" stroke-width="1.5" />
                  </g>
                  
                  <g fill="#64748b" font-size="11" font-weight="600" text-anchor="end">
                    <text x="50" y="44">100%</text>
                    <text x="50" y="104">75%</text>
                    <text x="50" y="164">50%</text>
                    <text x="50" y="224">25%</text>
                    <text x="50" y="284">0%</text>
                  </g>

                  <!-- Draw Area / Line Under Path -->
                  <path 
                    :d="`
                      M 80,280 
                      L 80,${280 - (dashboardStats.months[0].occupancyRate / 100 * 240)}
                      ${
                        dashboardStats.months.map((m, idx) => {
                          const x = 80 + idx * 78.18;
                          const y = 280 - (m.occupancyRate / 100 * 240);
                          return `L ${x},${y}`;
                        }).join(' ')
                      }
                      L 940,280 Z
                    `"
                    fill="url(#occupancyGrad)"
                  />
                  
                  <!-- Curved / Line Path -->
                  <path 
                    :d="`
                      M 80,${280 - (dashboardStats.months[0].occupancyRate / 100 * 240)}
                      ${
                        dashboardStats.months.map((m, idx) => {
                          const x = 80 + idx * 78.18;
                          const y = 280 - (m.occupancyRate / 100 * 240);
                          return `L ${x},${y}`;
                        }).join(' ')
                      }
                    `"
                    fill="none"
                    stroke="#2563eb"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  
                  <!-- Interactive Hover Guides and Points -->
                  <g v-for="(m, idx) in dashboardStats.months" :key="idx">
                    <!-- Hover Trigger Column Box -->
                    <rect 
                      :x="80 + idx * 78.18 - 35" 
                      y="30" 
                      width="70" 
                      height="260" 
                      fill="transparent" 
                      style="cursor: pointer;"
                      @mouseenter="dashboardHoveredMonth = idx"
                      @mouseleave="dashboardHoveredMonth = null"
                    />
                    
                    <!-- Line marker on hover -->
                    <line 
                      v-if="dashboardHoveredMonth === idx"
                      :x1="80 + idx * 78.18" 
                      y1="40" 
                      :x2="80 + idx * 78.18" 
                      y2="280" 
                      stroke="#93c5fd" 
                      stroke-width="1"
                      stroke-dasharray="4"
                    />
                    
                    <!-- Month point dot -->
                    <circle 
                      :cx="80 + idx * 78.18" 
                      :cy="280 - (m.occupancyRate / 100 * 240)" 
                      :r="dashboardHoveredMonth === idx ? 7 : 5" 
                      :fill="dashboardHoveredMonth === idx ? '#1d4ed8' : '#2563eb'" 
                      stroke="white" 
                      stroke-width="2"
                      style="transition: all 0.15s ease;"
                    />
                    
                    <!-- X-Axis Labels -->
                    <text 
                      :x="80 + idx * 78.18" 
                      y="302" 
                      fill="#64748b" 
                      font-size="11" 
                      font-weight="700" 
                      text-anchor="middle"
                      :style="dashboardHoveredMonth === idx ? 'fill: #0f172a; font-weight: 800;' : ''"
                    >
                      {{ m.monthName }}
                    </text>
                  </g>
                  
                  <!-- Overlay Tooltip right inside SVG -->
                  <g v-if="dashboardHoveredMonth !== null" :transform="`translate(${Math.min(740, Math.max(10, 80 + dashboardHoveredMonth * 78.18 - 100))}, ${Math.max(10, 210 - (dashboardStats.months[dashboardHoveredMonth].occupancyRate / 100 * 240))})`" pointer-events="none">
                    <rect width="200" height="95" rx="8" fill="#0f172a" opacity="0.95" />
                    <text x="15" y="24" fill="white" font-size="12" font-weight="800">{{ dashboardStats.months[dashboardHoveredMonth].monthName }} {{ dashboardYear }}</text>
                    
                    <text x="15" y="44" fill="#94a3b8" font-size="10" font-weight="700">Occupancy Rate:</text>
                    <text x="185" y="44" fill="#38bdf8" font-size="11" font-weight="800" text-anchor="end">{{ dashboardStats.months[dashboardHoveredMonth].occupancyRate.toFixed(1) }}%</text>
                    
                    <text x="15" y="62" fill="#94a3b8" font-size="10" font-weight="700">Occupied Nights:</text>
                    <text x="185" y="62" fill="white" font-size="10" font-weight="700" text-anchor="end">{{ dashboardStats.months[dashboardHoveredMonth].occupiedDays }} days</text>
                    
                    <text x="15" y="80" fill="#94a3b8" font-size="10" font-weight="700">Blocked / Total:</text>
                    <text x="185" y="80" fill="white" font-size="10" font-weight="700" text-anchor="end">{{ dashboardStats.months[dashboardHoveredMonth].blockedDays }} / {{ dashboardStats.months[dashboardHoveredMonth].totalDays }} days</text>
                  </g>
                </svg>
              </div>
            </div>

            <!-- Chart 2: Revenue & Earnings Side-by-Side Bar Chart -->
            <div class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
              <h3 style="font-size: 1rem; color: var(--primary); font-weight: 700; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
                <span class="material-icons-outlined" style="color: #16a34a;">bar_chart</span>
                Monthly Revenue & Doorman Earnings ({{ dashboardYear }})
              </h3>
              
              <!-- SVG Graph wrapper -->
              <div style="width: 100%; overflow-x: auto; padding-bottom: 0.5rem;">
                <svg viewBox="0 0 1000 320" style="width: 100%; min-width: 800px; height: auto; display: block;">
                  <!-- Definitions for Gradients -->
                  <defs>
                    <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#4ade80" />
                      <stop offset="100%" stop-color="#16a34a" />
                    </linearGradient>
                    <linearGradient id="doormanBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#fbbf24" />
                      <stop offset="100%" stop-color="#d97706" />
                    </linearGradient>
                  </defs>
                  
                  <g stroke="#f1f5f9" stroke-width="1">
                    <line x1="70" y1="40" x2="960" y2="40" />
                    <line x1="70" y1="100" x2="960" y2="100" />
                    <line x1="70" y1="160" x2="960" y2="160" />
                    <line x1="70" y1="220" x2="960" y2="220" />
                    <line x1="70" y1="280" x2="960" y2="280" stroke="#cbd5e1" stroke-width="1.5" />
                  </g>
                  
                  <g fill="#64748b" font-size="10" font-weight="700" text-anchor="end">
                    <text x="60" y="44">€{{ (Math.max(...dashboardStats.months.map(m => m.grossRevenue)) || 1000).toFixed(0) }}</text>
                    <text x="60" y="104">€{{ ((Math.max(...dashboardStats.months.map(m => m.grossRevenue)) || 1000) * 0.75).toFixed(0) }}</text>
                    <text x="60" y="164">€{{ ((Math.max(...dashboardStats.months.map(m => m.grossRevenue)) || 1000) * 0.5).toFixed(0) }}</text>
                    <text x="60" y="224">€{{ ((Math.max(...dashboardStats.months.map(m => m.grossRevenue)) || 1000) * 0.25).toFixed(0) }}</text>
                    <text x="60" y="284">€0</text>
                  </g>

                  <g v-for="(m, idx) in dashboardStats.months" :key="idx">
                    <!-- Gross Revenue Bar -->
                    <rect 
                      v-if="dashboardShowGross"
                      :x="(dashboardShowDoorman ? 95 : 105) + idx * 74" 
                      :y="280 - (m.grossRevenue / (Math.max(...dashboardStats.months.map(item => item.grossRevenue)) || 1000) * 240)" 
                      width="18" 
                      :height="(m.grossRevenue / (Math.max(...dashboardStats.months.map(item => item.grossRevenue)) || 1000) * 240)" 
                      fill="url(#revenueBarGrad)" 
                      rx="3" 
                    />
                    
                    <!-- Doorman Commission Bar -->
                    <rect 
                      v-if="dashboardShowDoorman"
                      :x="(dashboardShowGross ? 116 : 105) + idx * 74" 
                      :y="280 - (m.doormanEarnings / (Math.max(...dashboardStats.months.map(item => item.grossRevenue)) || 1000) * 240)" 
                      width="18" 
                      :height="(m.doormanEarnings / (Math.max(...dashboardStats.months.map(item => item.grossRevenue)) || 1000) * 240)" 
                      fill="url(#doormanBarGrad)" 
                      rx="3" 
                    />
                    
                    <!-- Text values above Gross Revenue bar -->
                    <text 
                      v-if="dashboardShowGross && m.grossRevenue > 0" 
                      :x="(dashboardShowDoorman ? 104 : 114) + idx * 74" 
                      :y="275 - (m.grossRevenue / (Math.max(...dashboardStats.months.map(item => item.grossRevenue)) || 1000) * 240)"
                      fill="#16a34a"
                      font-size="9"
                      font-weight="700"
                      text-anchor="middle"
                    >
                      €{{ m.grossRevenue.toFixed(0) }}
                    </text>

                    <!-- Text values above Doorman Earnings bar -->
                    <text 
                      v-if="dashboardShowDoorman && m.doormanEarnings > 0" 
                      :x="(dashboardShowGross ? 125 : 114) + idx * 74" 
                      :y="275 - (m.doormanEarnings / (Math.max(...dashboardStats.months.map(item => item.grossRevenue)) || 1000) * 240)"
                      fill="#d97706"
                      font-size="9"
                      font-weight="700"
                      text-anchor="middle"
                    >
                      €{{ m.doormanEarnings.toFixed(0) }}
                    </text>

                    <text 
                      :x="114 + idx * 74" 
                      y="302" 
                      fill="#64748b" 
                      font-size="11" 
                      font-weight="700" 
                      text-anchor="middle"
                    >
                      {{ m.monthName }}
                    </text>
                  </g>
                </svg>
              </div>

              <!-- Interactive Legend -->
              <div style="display: flex; justify-content: center; gap: 2rem; margin-top: 1.25rem; font-size: 0.85rem; font-weight: 700;">
                <div 
                  @click="dashboardShowGross = !dashboardShowGross" 
                  style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 4px 12px; border-radius: 6px; transition: all 0.2s; user-select: none;"
                  :style="dashboardShowGross ? 'background: #f0fdf4; border: 1px solid #bbf7d0;' : 'opacity: 0.5; background: #f3f4f6; border: 1px solid #e5e7eb; text-decoration: line-through;'"
                >
                  <span style="display: inline-block; width: 14px; height: 14px; background: #16a34a; border-radius: 3px;"></span>
                  <span style="color: #166534;">Gross Revenue</span>
                </div>
                <div 
                  @click="dashboardShowDoorman = !dashboardShowDoorman" 
                  style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 4px 12px; border-radius: 6px; transition: all 0.2s; user-select: none;"
                  :style="dashboardShowDoorman ? 'background: #fffbeb; border: 1px solid #fde68a;' : 'opacity: 0.5; background: #f3f4f6; border: 1px solid #e5e7eb; text-decoration: line-through;'"
                >
                  <span style="display: inline-block; width: 14px; height: 14px; background: #d97706; border-radius: 3px;"></span>
                  <span style="color: #92400e;">Doorman Payout</span>
                </div>
              </div>

            </div>

          </div>

          <!-- Monthly Statistics Table Card -->
          <div class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); overflow-x: auto;">
            <h3 style="font-size: 1rem; color: var(--primary); font-weight: 700; margin: 0 0 1.25rem 0; display: flex; align-items: center; gap: 0.5rem;">
              <span class="material-icons-outlined" style="color: var(--primary);">grid_on</span>
              Detailed Monthly Breakdown ({{ dashboardYear }})
            </h3>
            
            <table style="width: 100%; border-collapse: collapse; min-width: 750px; font-size: 0.9rem; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid #f3f4f6; color: #4b5563; font-weight: 700; background-color: #f9fafb;">
                  <th style="padding: 12px;">Month</th>
                  <th style="padding: 12px; text-align: center;">Occupancy Rate</th>
                  <th style="padding: 12px; text-align: center;">Occupied Nights</th>
                  <th style="padding: 12px; text-align: center;">Blocked Days</th>
                  <th style="padding: 12px; text-align: right;">Gross Revenue</th>
                  <th style="padding: 12px; text-align: right;">Doorman Commission</th>
                  <th style="padding: 12px; text-align: center;">Bookings</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in dashboardStats.months" :key="m.monthIdx" style="border-bottom: 1px solid #f3f4f6; transition: background 0.15s;" class="hover-row">
                  <td style="padding: 12px; font-weight: 700; color: var(--primary);">{{ m.monthName }}</td>
                  <td style="padding: 12px; text-align: center; font-weight: 700;">
                    <span :style="{ color: m.occupancyRate > 70 ? '#16a34a' : m.occupancyRate > 40 ? '#d97706' : '#ef4444' }">
                      {{ m.occupancyRate.toFixed(1) }}%
                    </span>
                  </td>
                  <td style="padding: 12px; text-align: center; color: #374151; font-weight: 600;">{{ m.occupiedDays }} days</td>
                  <td style="padding: 12px; text-align: center; color: #64748b;">{{ m.blockedDays }} days</td>
                  <td style="padding: 12px; text-align: right; font-weight: 700; color: #16a34a;">€{{ m.grossRevenue.toFixed(2) }}</td>
                  <td style="padding: 12px; text-align: right; font-weight: 700; color: #d97706;">€{{ m.doormanEarnings.toFixed(2) }}</td>
                  <td style="padding: 12px; text-align: center; color: #4b5563; font-weight: 600;">{{ m.bookingsCount }} res.</td>
                </tr>
              </tbody>
              <tfoot style="font-weight: 800; border-top: 2px solid #cbd5e1; background-color: #f8fafc;">
                <tr>
                  <td style="padding: 12px; color: var(--primary);">Totals / Average</td>
                  <td style="padding: 12px; text-align: center; color: #1d4ed8; font-size: 0.95rem;">{{ dashboardStats.avgOccupancy.toFixed(1) }}% (Avg)</td>
                  <td style="padding: 12px; text-align: center; color: #374151;">{{ dashboardStats.totalOccupied }} days</td>
                  <td style="padding: 12px; text-align: center; color: #64748b;">{{ dashboardStats.totalBlocked }} days</td>
                  <td style="padding: 12px; text-align: right; color: #16a34a; font-size: 0.95rem;">€{{ dashboardStats.totalGross.toFixed(2) }}</td>
                  <td style="padding: 12px; text-align: right; color: #d97706; font-size: 0.95rem;">€{{ dashboardStats.totalDoorman.toFixed(2) }}</td>
                  <td style="padding: 12px; text-align: center; color: #4b5563;">{{ dashboardStats.totalBookings }} res.</td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>

        <!-- Reservations List Full Page -->
        <div v-else-if="currentConciergeView === 'reservations-list'" class="concierge-dashboard">
          <section class="admin-section card" style="padding: 1.5rem;">

            <!-- Filters Row -->
            <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.5rem;">
              <!-- Search -->
              <div style="flex: 1; min-width: 180px; position: relative;">
                <span class="material-icons-outlined" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #9ca3af; font-size: 1.1rem;">search</span>
                <input
                  v-model="reservationListFilter.search"
                  type="text"
                  placeholder="Search guest or property..."
                  style="width: 100%; padding: 0.6rem 1rem 0.6rem 2.5rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem;"
                />
              </div>
              <!-- Year Filter -->
              <select v-model="reservationListFilter.year" style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; background: white; min-width: 110px;">
                <option value="all">All Years</option>
                <option v-for="yr in availableYears" :key="yr" :value="yr">{{ yr }}</option>
              </select>
              <!-- Month Filter -->
              <select v-model="reservationListFilter.month" style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; background: white; min-width: 130px;">
                <option value="all">All Months</option>
                <option value="0">January</option>
                <option value="1">February</option>
                <option value="2">March</option>
                <option value="3">April</option>
                <option value="4">May</option>
                <option value="5">June</option>
                <option value="6">July</option>
                <option value="7">August</option>
                <option value="8">September</option>
                <option value="9">October</option>
                <option value="10">November</option>
                <option value="11">December</option>
              </select>
              <!-- Property Filter -->
              <select v-model="reservationListFilter.property" style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; background: white; min-width: 160px;">
                <option value="all">All Properties</option>
                <option v-for="prop in conciergeProperties" :key="prop.id" :value="prop.id">{{ prop.title }}</option>
              </select>
              <!-- Platform Filter -->
              <select v-model="reservationListFilter.platform" style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; background: white; min-width: 140px;">
                <option value="all">All Platforms</option>
                <option value="airbnb">Airbnb</option>
                <option value="booking">Booking.com</option>
                <option value="resaoff">Resaoff</option>
              </select>
              <!-- Rows Per Page -->
              <select v-model="reservationsPerPage" style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; background: white; min-width: 110px;">
                <option :value="10">10 per page</option>
                <option :value="20">20 per page</option>
                <option :value="50">50 per page</option>
                <option :value="100">100 per page</option>
              </select>
              <!-- Reset Button -->
              <button
                @click="reservationListFilter = { property: 'all', platform: 'all', search: '', year: 'all', month: 'all' }"
                style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.85rem; background: white; color: #6b7280; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem;"
              >
                <span class="material-icons-outlined" style="font-size: 1rem;">refresh</span>
                Reset
              </button>
              
              <!-- Export Excel Button -->
              <button
                @click="exportReservationsToExcel(allReservations)"
                style="padding: 0.6rem 1.2rem; border: 1.5px solid #107c41; border-radius: 8px; font-size: 0.85rem; background: #107c41; color: white; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; font-weight: 700; margin-left: auto;"
              >
                <span class="material-icons-outlined" style="font-size: 1rem;">download_for_offline</span>
                Export to Excel
              </button>

              <!-- Count badge -->
              <span style="font-size: 0.85rem; color: #6b7280; white-space: nowrap;">
                <strong style="color: var(--primary);">{{ allReservations.length }}</strong> reservation{{ allReservations.length !== 1 ? 's' : '' }}
              </span>
            </div>

            <!-- Table -->
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                <thead>
                  <tr style="border-bottom: 2px solid #e5e7eb; background: #f9fafb; text-align: left;">
                    <th style="padding: 0.75rem 1rem; font-weight: 700; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;">Platform</th>
                    <th style="padding: 0.75rem 1rem; font-weight: 700; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;">Property</th>
                    <th style="padding: 0.75rem 1rem; font-weight: 700; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;">Guest</th>
                    <th style="padding: 0.75rem 1rem; font-weight: 700; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;">Check-in</th>
                    <th style="padding: 0.75rem 1rem; font-weight: 700; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;">Check-out</th>
                    <th style="padding: 0.75rem 1rem; font-weight: 700; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; text-align: center;">Nights</th>
                    <th style="padding: 0.75rem 1rem; font-weight: 700; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; text-align: right;">Gross (€)</th>
                    <th style="padding: 0.75rem 1rem; font-weight: 700; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; text-align: right;">Doorman (€)</th>
                    <th style="padding: 0.75rem 1rem; font-weight: 700; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; text-align: right;">Owner (€)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="allReservations.length === 0">
                    <td colspan="9" style="padding: 2rem; text-align: center; color: #9ca3af;">No reservations found.</td>
                  </tr>
                  <tr
                    v-for="b in paginatedReservations"
                    :key="b.id"
                    style="border-bottom: 1px solid #f3f4f6; transition: background 0.15s; cursor: pointer;"
                    @mouseenter="$event.currentTarget.style.background='#f9fafb'"
                    @mouseleave="$event.currentTarget.style.background=''"
                  >
                    <!-- Platform badge -->
                    <td style="padding: 0.75rem 1rem;">
                      <span
                        style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700;"
                        :style="b.platform === 'airbnb' ? 'background:#fee2e2; color:#b91c1c;' : b.platform === 'booking' ? 'background:#dbeafe; color:#1d4ed8;' : 'background:#ffedd5; color:#c2410c;'"
                      >
                        {{ b.platform === 'airbnb' ? 'Airbnb' : b.platform === 'booking' ? 'Booking' : 'Resaoff' }}
                      </span>
                    </td>
                    <!-- Property -->
                    <td style="padding: 0.75rem 1rem; font-weight: 600; color: var(--primary);">{{ b.propertyTitle }}</td>
                    <!-- Guest -->
                    <td style="padding: 0.75rem 1rem; color: #374151;">{{ b.guest_name || b.summary || '—' }}</td>
                    <!-- Check-in -->
                    <td style="padding: 0.75rem 1rem; color: #374151;">{{ formatDateToEU(b.start_date) }}</td>
                    <!-- Check-out -->
                    <td style="padding: 0.75rem 1rem; color: #374151;">{{ formatDateToEU(b.end_date) }}</td>
                    <!-- Nights -->
                    <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 600; color: #374151;">{{ b.nights || '—' }}</td>
                    <!-- Gross -->
                    <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 600; color: #0f172a;">{{ b.price ? '€' + parseFloat(b.price).toFixed(2) : '—' }}</td>
                    <!-- Doorman -->
                    <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 700; color: #0c4a6e;">{{ b.doorman_commission ? '€' + parseFloat(b.doorman_commission).toFixed(2) : '—' }}</td>
                    <!-- Owner -->
                    <td style="padding: 0.75rem 1rem; text-align: right; color: #4b5563;">{{ b.owner_payout ? '€' + parseFloat(b.owner_payout).toFixed(2) : '—' }}</td>
                  </tr>
                </tbody>
                <!-- Totals footer -->
                <tfoot v-if="allReservations.length > 0">
                  <tr style="border-top: 2px solid #e5e7eb; background: #f0f9ff;">
                    <td colspan="6" style="padding: 0.75rem 1rem; font-weight: 700; color: #374151; font-size: 0.8rem; text-transform: uppercase;">Totals ({{ allReservations.length }} res.)</td>
                    <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 800; color: #0f172a;">
                      €{{ allReservations.reduce((s, b) => s + parseFloat(b.price || 0), 0).toFixed(2) }}
                    </td>
                    <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 800; color: #0c4a6e;">
                      €{{ allReservations.reduce((s, b) => s + parseFloat(b.doorman_commission || 0), 0).toFixed(2) }}
                    </td>
                    <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 800; color: #4b5563;">
                      €{{ allReservations.reduce((s, b) => s + parseFloat(b.owner_payout || 0), 0).toFixed(2) }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Reservations Pagination Controls -->
            <div 
              v-if="reservationsTotalPages > 1"
              style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; flex-wrap: wrap; gap: 1rem;"
            >
              <div style="font-size: 0.85rem; color: #64748b;">
                Showing page {{ reservationsCurrentPage }} of {{ reservationsTotalPages }} ({{ allReservations.length }} total reservations)
              </div>
              <div style="display: flex; gap: 0.35rem; align-items: center;">
                <button 
                  @click="reservationsCurrentPage = Math.max(1, reservationsCurrentPage - 1)" 
                  :disabled="reservationsCurrentPage === 1"
                  style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;"
                  :style="reservationsCurrentPage === 1 ? 'opacity:0.5; cursor:not-allowed;' : ''"
                >
                  <span class="material-icons-outlined" style="font-size: 1rem;">chevron_left</span>
                  Prev
                </button>

                <button 
                  v-for="p in reservationsTotalPages" 
                  :key="p"
                  @click="reservationsCurrentPage = p"
                  style="padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;"
                  :style="p === reservationsCurrentPage ? 'background: #2563eb; color: white; border: 1px solid #2563eb;' : 'background: white; color: #475569; border: 1px solid #e2e8f0;'"
                >
                  {{ p }}
                </button>

                <button 
                  @click="reservationsCurrentPage = Math.min(reservationsTotalPages, reservationsCurrentPage + 1)" 
                  :disabled="reservationsCurrentPage === reservationsTotalPages"
                  style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;"
                  :style="reservationsCurrentPage === reservationsTotalPages ? 'opacity:0.5; cursor:not-allowed;' : ''"
                >
                  Next
                  <span class="material-icons-outlined" style="font-size: 1rem;">chevron_right</span>
                </button>
              </div>
            </div>

          </section>
        </div>

        <!-- Cleaning Schedule Full Page -->
        <div v-else-if="currentConciergeView === 'cleaning'" class="concierge-dashboard">
          <div style="display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; align-items: start;">

            <!-- LEFT: Cleaner Management Panel -->
            <div style="display: flex; flex-direction: column; gap: 1rem;">

              <!-- Add/Edit Cleaner Card -->
              <section class="admin-section card" style="padding: 1.25rem;">
                <h3 style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; color: #64748b; margin: 0 0 1rem; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem;">
                  <span class="material-icons-outlined" style="font-size: 1rem; vertical-align: middle; margin-right: 0.35rem;">
                    {{ isEditingCleaner ? 'edit' : 'person_add' }}
                  </span>
                  {{ isEditingCleaner ? 'Edit Cleaner' : 'Add Cleaner' }}
                </h3>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                  <input
                    v-model="newCleanerForm.name"
                    type="text"
                    placeholder="Full name *"
                    style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;"
                    @keyup.enter="isEditingCleaner ? updateCleaner() : addCleaner()"
                  />
                  <input
                    v-model.number="newCleanerForm.hourly_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Hourly rate €/hr (optional)"
                    style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;"
                    @keyup.enter="isEditingCleaner ? updateCleaner() : addCleaner()"
                  />
                  <div style="display: flex; gap: 0.5rem;">
                    <button 
                      @click="isEditingCleaner ? updateCleaner() : addCleaner()" 
                      class="submit-btn" 
                      style="flex: 1; justify-content: center; padding: 0.6rem;"
                    >
                      <span class="material-icons-outlined" style="font-size: 1rem; margin-right: 0.35rem;">
                        {{ isEditingCleaner ? 'save' : 'add' }}
                      </span>
                      {{ isEditingCleaner ? 'Save' : 'Add' }}
                    </button>
                    <button 
                      v-if="isEditingCleaner" 
                      @click="cancelEditCleaner" 
                      class="cancel-btn" 
                      style="padding: 0.6rem 1rem; background-color: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.85rem;"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </section>

              <!-- Cleaners List Card -->
              <section class="admin-section card" style="padding: 1.25rem;">
                <h3 style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; color: #64748b; margin: 0 0 1rem; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem;">
                  <span class="material-icons-outlined" style="font-size: 1rem; vertical-align: middle; margin-right: 0.35rem;">group</span>
                  Cleaners ({{ cleaners.length }})
                </h3>
                <div v-if="cleaners.length === 0" style="color: #9ca3af; font-size: 0.85rem; text-align: center; padding: 1rem 0;">
                  No cleaners added yet.
                </div>
                <div v-for="c in cleaners" :key="c.id" style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid #f3f4f6;">
                  <div>
                    <div style="font-weight: 600; color: var(--primary); font-size: 0.9rem;">{{ c.name }}</div>
                    <div v-if="c.hourly_rate" style="font-size: 0.75rem; color: #059669; font-weight: 600;">€{{ parseFloat(c.hourly_rate).toFixed(2) }}/hr</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <button @click="startEditCleaner(c)" title="Edit cleaner" style="border: none; background: none; color: #3b82f6; cursor: pointer; padding: 0.25rem; border-radius: 4px; display: flex; align-items: center;">
                      <span class="material-icons-outlined" style="font-size: 1.15rem;">edit</span>
                    </button>
                    <button @click="deleteCleaner(c.id)" style="border: none; background: none; color: #ef4444; cursor: pointer; padding: 0.25rem; border-radius: 4px; display: flex; align-items: center;">
                      <span class="material-icons-outlined" style="font-size: 1.15rem;">delete_outline</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <!-- RIGHT: Schedule Panel -->
            <section class="admin-section card" style="padding: 1.25rem;">

              <!-- Date Picker -->
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                  <div>
                    <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.4rem;">Cleaning Date</label>
                    <input
                      v-model="cleaningSelectedDate"
                      type="date"
                      style="padding: 0.6rem 1rem; border: 1.5px solid var(--accent); border-radius: 8px; font-size: 0.95rem; font-weight: 600; color: var(--primary);"
                    />
                  </div>
                  <button
                    @click="copyCleaningSchedule"
                    class="action-header-btn"
                    style="margin-top: auto; padding: 0.6rem 1.25rem; background-color: #25d366; color: white; border: none; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.9rem;"
                  >
                    <span class="material-icons-outlined">share</span>
                    Copy WhatsApp Message
                  </button>
                </div>
                <div style="flex: 1; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.85rem; color: #0369a1; min-width: 250px;">
                  <span class="material-icons-outlined" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">info</span>
                  List of properties with check-out on the selected date. Assign a cleaner to each.
                </div>
              </div>

              <!-- Checkout list for date -->
              <div v-if="checkoutsOnSelectedDate.length === 0" style="text-align: center; padding: 2rem 0; color: #9ca3af;">
                <span class="material-icons-outlined" style="font-size: 2.5rem; display: block; margin-bottom: 0.5rem;">event_busy</span>
                No properties checking out on this date.
              </div>

              <div v-else style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- Unassigned Checkouts Section -->
                <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 1.25rem;">
                  <h4 style="font-size: 0.85rem; font-weight: 800; text-transform: uppercase; color: #b45309; margin: 0 0 0.75rem; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.35rem;">
                    <span class="material-icons-outlined" style="font-size: 1.1rem;">pending_actions</span>
                    Pending Checkouts ({{ unassignedCheckouts.length }})
                  </h4>
                  <div v-if="unassignedCheckouts.length === 0" style="color: #15803d; font-size: 0.85rem; font-weight: 600;">
                    All properties checked out on this date have been assigned to cleaners!
                  </div>
                  <div v-else style="display: flex; flex-wrap: wrap; gap: 0.6rem;">
                    <div 
                      v-for="item in unassignedCheckouts" 
                      :key="item.prop.id + '-' + item.booking.end_date"
                      style="background: white; border: 1px solid #fcd34d; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; font-weight: 600; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;"
                    >
                      <span>
                        {{ item.prop.title }} ({{ item.booking.guest_name || 'No Guest' }})
                        <span v-if="item.booking.end_date !== cleaningSelectedDate" style="font-size: 0.72rem; color: #b45309; background-color: #fffbeb; border: 1px solid #fde68a; padding: 2px 5px; border-radius: 4px; font-weight: 700; margin-left: 0.35rem; display: inline-flex; align-items: center; gap: 0.15rem;">
                          <span class="material-icons-outlined" style="font-size: 0.8rem; color: #d97706;">warning</span>
                          from {{ formatDateToEU(item.booking.end_date) }}
                        </span>
                      </span>
                      <button 
                        @click="deletePendingCleaning(item.prop.id, item.booking.end_date)" 
                        style="border: none; background: none; color: #ef4444; cursor: pointer; padding: 0.15rem; display: flex; align-items: center; border-radius: 4px; margin-left: auto;"
                        title="Cancel/Delete Cleaning"
                      >
                        <span class="material-icons-outlined" style="font-size: 1.05rem;">close</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Cleaners Schedule Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1.25rem;">
                  <div 
                    v-for="c in cleaners" 
                    :key="c.id"
                    style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.25rem; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between; min-height: 220px;"
                  >
                    <div>
                      <!-- Cleaner Header -->
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.5rem;">
                        <span style="font-weight: 800; font-size: 1rem; color: var(--primary); display: flex; align-items: center; gap: 0.35rem;">
                          <span class="material-icons-outlined" style="color: var(--accent);">person</span>
                          {{ c.name }}
                        </span>
                        <span style="font-size: 0.75rem; color: #6b7280;">{{ c.phone || 'No phone' }}</span>
                      </div>

                      <!-- Assigned Properties List -->
                      <div style="margin-bottom: 1rem;">
                        <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #9ca3af; margin-bottom: 0.5rem;">Assigned Properties</div>
                        
                        <div v-if="getAssignmentsForCleaner(c.id).length === 0" style="color: #9ca3af; font-size: 0.85rem; font-style: italic;">
                          No properties assigned on this date.
                        </div>
                        <div v-else style="display: flex; flex-direction: column; gap: 0.5rem;">
                          <div 
                            v-for="a in getAssignmentsForCleaner(c.id)" 
                            :key="a.id"
                            style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem;"
                          >
                            <div style="flex: 1;">
                              <strong style="color: var(--primary);">{{ a.property?.title }}</strong>
                              <div v-if="a.notes" style="font-size: 0.75rem; color: #6b7280; margin-top: 0.15rem;">Note: {{ a.notes }}</div>
                            </div>
                            <button 
                              @click="removeAssignment(a.id)" 
                              style="border: none; background: none; color: #ef4444; cursor: pointer; padding: 0.25rem; display: flex; align-items: center;"
                              title="Remove Assignment"
                            >
                              <span class="material-icons-outlined" style="font-size: 1.05rem;">close</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Assign Form for Cleaner -->
                    <div style="border-top: 1px dashed #e2e8f0; padding-top: 1rem; margin-top: auto;">
                      <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #9ca3af; margin-bottom: 0.5rem;">Assign New Property</div>
                      
                      <div v-if="unassignedCheckouts.length === 0" style="color: #9ca3af; font-size: 0.8rem; font-style: italic;">
                        No pending checkouts available to assign.
                      </div>
                      <div v-else style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <select
                          v-model="cleanerSelectedProperty[c.id]"
                          style="width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.85rem; background: white;"
                        >
                          <option value="">— Select Property —</option>
                          <option 
                            v-for="item in unassignedCheckouts" 
                            :key="item.prop.id" 
                            :value="item.prop.id"
                          >
                            {{ item.prop.title }} ({{ item.booking.guest_name || 'No Guest' }})
                          </option>
                        </select>
                        <div style="display: flex; gap: 0.5rem;">
                          <input
                            v-model="cleanerAssignmentNote[c.id]"
                            type="text"
                            placeholder="Note (optional)"
                            style="flex: 1; padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.85rem;"
                          />
                          <button
                            @click="assignCleaner(cleanerSelectedProperty[c.id], c.id, cleanerAssignmentNote[c.id]); cleanerSelectedProperty[c.id] = ''; cleanerAssignmentNote[c.id] = '';"
                            class="submit-btn"
                            style="padding: 0.5rem 1rem; font-size: 0.85rem;"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </section>
          </div>
        </div>

        <!-- Add Reservation Full Page -->
        <div v-else-if="currentConciergeView === 'add-reservation'" class="concierge-dashboard">
          <section class="admin-section card" style="padding: 2rem; max-width: 680px; margin: 0 auto;">
            <form @submit.prevent="saveQuickBooking" style="display: flex; flex-direction: column; gap: 1.5rem;">
              
              <!-- Property Selector -->
              <div>
                <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">Select Property</label>
                <select v-model="quickBookingPropertyId" required style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 1rem; background: white; width: 100%; color: var(--primary); font-weight: 600;">
                  <option v-for="prop in conciergeProperties" :key="prop.id" :value="prop.id">
                    {{ prop.title }}{{ prop.address ? ' — ' + prop.address : '' }}
                  </option>
                </select>
              </div>

              <!-- Block Calendar Checkbox -->
              <div style="background-color: #f3f4f6; padding: 0.75rem 1rem; border-radius: 8px;">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.9rem; color: var(--primary); cursor: pointer; margin: 0;">
                  <input type="checkbox" v-model="bookingForm.is_block" style="width: 18px; height: 18px; cursor: pointer;" />
                  Block Calendar (Owner / Maintenance Usage)
                </label>
              </div>

              <!-- Platform -->
              <div v-if="!bookingForm.is_block">
                <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">Platform / Source</label>
                <select v-model="bookingForm.platform" :required="!bookingForm.is_block" style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 0.95rem; background: white; width: 100%;">
                  <option value="airbnb">Airbnb</option>
                  <option value="booking">Booking.com</option>
                  <option value="resaoff">Resaoff (Offline / Direct)</option>
                </select>
              </div>

              <!-- Guest Name -->
              <div v-if="!bookingForm.is_block">
                <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">Guest Name (First & Last)</label>
                <input v-model="bookingForm.guest_name" type="text" :required="!bookingForm.is_block" placeholder="e.g. John Doe" style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 0.95rem; width: 100%;" />
              </div>

              <!-- Check-in / Check-out dates -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">{{ bookingForm.is_block ? 'Block Start Date' : 'Check-in Date' }}</label>
                  <input v-model="bookingForm.start_date" type="date" required style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 0.95rem; width: 100%;" />
                </div>
                <div>
                  <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">{{ bookingForm.is_block ? 'Block End Date' : 'Check-out Date' }}</label>
                  <input v-model="bookingForm.end_date" type="date" required style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 0.95rem; width: 100%;" />
                </div>
              </div>

              <!-- Nights Stayed -->
              <div>
                <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">{{ bookingForm.is_block ? 'Blocked Days (Auto-calculated)' : 'Nights Stayed (Auto-calculated)' }}</label>
                <input :value="nightsCount + (bookingForm.is_block ? ' days' : ' nights')" type="text" disabled style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 0.95rem; background-color: #f3f4f6; color: #374151; font-weight: 600; width: 100%;" />
              </div>

              <!-- Financial Info -->
              <div v-if="!bookingForm.is_block" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">Total Gross Price (€)</label>
                  <input v-model.number="bookingForm.price" type="number" step="0.01" :required="!bookingForm.is_block" placeholder="0.00" style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 0.95rem; width: 100%;" />
                </div>
                <div>
                  <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">Platform Service Fee (€)</label>
                  <input v-model.number="bookingForm.platform_fee" type="number" step="0.01" placeholder="0.00" style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 0.95rem; width: 100%;" />
                </div>
              </div>

              <!-- Commission Rate -->
              <div v-if="!bookingForm.is_block">
                <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">Doorman Commission Rate (%)</label>
                <input v-model.number="bookingForm.commission_rate" type="number" step="0.1" :required="!bookingForm.is_block" style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 0.95rem; width: 100%;" />
              </div>

              <!-- Notes -->
              <div>
                <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">{{ bookingForm.is_block ? 'Block Reason / Notes' : 'Notes (Max 100 chars)' }}</label>
                <input v-model="bookingForm.notes" type="text" maxlength="100" placeholder="e.g. Owner stay, renovation, pipe repair..." style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 0.95rem; width: 100%;" />
              </div>

              <!-- Live Payout Breakdown -->
              <div v-if="!bookingForm.is_block" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                <h3 style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; color: #0369a1; margin: 0; border-bottom: 1px solid #bae6fd; padding-bottom: 0.5rem; letter-spacing: 0.05em;">
                  Live Payout Breakdown
                </h3>

                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                  <span style="color: #475569;">Nightly Rate (Avg):</span>
                  <strong style="color: #0f172a;">€{{ payoutBreakdown.nightly }} / night</strong>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                  <span style="color: #475569;">Net Income (Gross − Fee):</span>
                  <strong style="color: #0f172a;">€{{ payoutBreakdown.net }}</strong>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                  <span style="color: #475569;">Owner Share:</span>
                  <strong style="color: #64748b;">€{{ payoutBreakdown.owner }}</strong>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 1rem; border-top: 2px solid #7dd3fc; padding-top: 0.6rem;">
                  <span style="color: #0f172a; font-weight: 700;">Doorman Payout ({{ bookingForm.commission_rate }}%):</span>
                  <strong style="color: #0c4a6e; font-weight: 900; font-size: 1.1rem;">€{{ payoutBreakdown.doorman }}</strong>
                </div>
              </div>

              <!-- Submit -->
              <button type="submit" class="submit-btn" style="width: 100%; padding: 1rem; justify-content: center; font-weight: 700; font-size: 1rem; margin-top: 0.5rem;">
                <span class="material-icons-outlined" style="margin-right: 0.5rem;">save</span>
                Save Reservation
              </button>

            </form>
          </section>
        </div>

        <!-- Main Dashboard: Timeline Scheduler Calendar -->
        <div v-else-if="currentConciergeView === 'calendar'" class="concierge-dashboard">
          <!-- Calendar Card -->
          <section class="admin-section card" style="padding: 1.5rem;">
            <div class="calendar-controls-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <!-- Today Button -->
                <button
                  @click="scrollToToday"
                  style="padding: 0.45rem 1rem; border: 1.5px solid var(--accent); background: var(--accent); color: var(--primary); border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 0.35rem; transition: opacity 0.15s;"
                  @mouseenter="$event.target.style.opacity='0.85'"
                  @mouseleave="$event.target.style.opacity='1'"
                >
                  <span class="material-icons-outlined" style="font-size: 1rem;">today</span>
                  Today
                </button>
                <div class="calendar-nav" style="display: flex; align-items: center; gap: 0.75rem;">
                <button @click="prevMonth" class="action-btn" style="padding: 0.5rem; border: 1px solid #eee; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center;">
                  <span class="material-icons-outlined">chevron_left</span>
                </button>
                
                <!-- Month Dropdown -->
                <select v-model="currentMonth" style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #eee; background: white; font-weight: 600; color: var(--primary); cursor: pointer; font-size: 0.9rem;">
                  <option v-for="(mName, idx) in monthNames" :key="idx" :value="idx">{{ mName }}</option>
                </select>

                <!-- Year Dropdown -->
                <select v-model="currentYear" style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #eee; background: white; font-weight: 600; color: var(--primary); cursor: pointer; font-size: 0.9rem;">
                  <option v-for="y in [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032]" :key="y" :value="y">{{ y }}</option>
                </select>

                <button @click="nextMonth" class="action-btn" style="padding: 0.5rem; border: 1px solid #eee; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center;">
                  <span class="material-icons-outlined">chevron_right</span>
                </button>
              </div>
              
              <div style="font-size: 0.85rem; color: #6b7280; font-weight: 600;">
                <span class="material-icons-outlined" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem; color: var(--accent);">info</span>
                Scroll horizontally to view all days of the month.
                </div>
              </div>
            </div>

            <!-- Property Search / Filter Bar (Multi-select) -->
            <div class="timeline-property-filter-container" style="position: relative; margin-bottom: 1.25rem; z-index: 99;">
              <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem; letter-spacing: 0.05em;">Filter Properties</label>
              
              <div 
                @click="showTimelinePropertyDropdown = !showTimelinePropertyDropdown"
                style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.55rem 1rem; border: 1.5px solid #e2e8f0; border-radius: 8px; background: white; cursor: pointer; min-height: 42px; position: relative;"
              >
                <!-- Selected tags list -->
                <div v-if="selectedTimelineProperties.length === 0" style="color: #94a3b8; font-size: 0.9rem; font-weight: 500;">
                  Showing all properties (Click to filter...)
                </div>
                <div v-else style="display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center;">
                  <span 
                    v-for="id in selectedTimelineProperties" 
                    :key="id" 
                    style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.15rem 0.5rem; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;"
                    @click.stop="toggleTimelineProperty(id)"
                  >
                    {{ conciergeProperties.find(p => p.id === id)?.title }}
                    <span class="material-icons-outlined" style="font-size: 0.9rem; cursor: pointer;">close</span>
                  </span>
                </div>
                
                <span class="material-icons-outlined" style="margin-left: auto; color: #64748b;">
                  {{ showTimelinePropertyDropdown ? 'expand_less' : 'expand_more' }}
                </span>
              </div>

              <!-- Dropdown Panel -->
              <transition name="fade">
                <div 
                  v-if="showTimelinePropertyDropdown" 
                  style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1.5px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); margin-top: 0.35rem; padding: 1rem; z-index: 999; display: flex; flex-direction: column; gap: 0.75rem;"
                  @click.stop
                >
                  <!-- Search input inside dropdown -->
                  <div style="position: relative;">
                    <span class="material-icons-outlined" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 1.15rem;">search</span>
                    <input 
                      v-model="timelinePropertySearch" 
                      type="text" 
                      placeholder="Search property name..." 
                      style="width: 100%; padding: 0.5rem 1rem 0.5rem 2.25rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.875rem;"
                      @click.stop
                    />
                  </div>

                  <!-- Quick Actions (Select All, Clear) -->
                  <div style="display: flex; gap: 0.5rem;">
                    <button 
                      @click="selectAllTimelineProperties" 
                      style="background: #f1f5f9; border: none; color: #475569; padding: 0.35rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: background 0.15s;"
                      @mouseenter="$event.target.style.background='#e2e8f0'"
                      @mouseleave="$event.target.style.background='#f1f5f9'"
                    >
                      Select All
                    </button>
                    <button 
                      @click="clearTimelineProperties" 
                      style="background: #f1f5f9; border: none; color: #475569; padding: 0.35rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: background 0.15s;"
                      @mouseenter="$event.target.style.background='#e2e8f0'"
                      @mouseleave="$event.target.style.background='#f1f5f9'"
                    >
                      Clear Selection
                    </button>
                  </div>

                  <!-- Properties list with checkboxes -->
                  <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.35rem;">
                    <label 
                      v-for="p in filteredTimelinePropertiesDropdown" 
                      :key="p.id" 
                      style="display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; border-radius: 6px; cursor: pointer; transition: background 0.15s; font-size: 0.875rem;"
                      @mouseenter="$event.target.style.background='#f8fafc'"
                      @mouseleave="$event.target.style.background='transparent'"
                    >
                      <input 
                        type="checkbox" 
                        :checked="selectedTimelineProperties.includes(p.id)" 
                        @change="toggleTimelineProperty(p.id)"
                        style="width: 16px; height: 16px; border-radius: 4px; accent-color: #2563eb; cursor: pointer;"
                      />
                      <span style="font-weight: 600; color: #334155;">{{ p.title }}</span>
                      <span v-if="p.address" style="font-size: 0.75rem; color: #94a3b8; font-weight: 400; margin-left: auto;">{{ p.address }}</span>
                    </label>
                    <div v-if="filteredTimelinePropertiesDropdown.length === 0" style="padding: 1rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">
                      No properties found matching your search.
                    </div>
                  </div>
                </div>
              </transition>
            </div>

            <!-- Timeline Scheduler Grid -->
            <div class="timeline-container" style="overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div class="timeline-grid" :style="{ minWidth: (220 + daysInActiveMonth.length * 45) + 'px' }">
                
                <!-- Header Row -->
                <div class="timeline-row header-row" style="display: flex; border-bottom: 1px solid #e5e7eb; background: #f9fafb; min-height: 55px;">
                  <div class="timeline-cell property-col header" style="width: 220px; min-width: 220px; padding: 1rem; font-weight: 700; color: var(--primary); position: sticky; left: 0; background: #f9fafb; border-right: 1px solid #e5e7eb; z-index: 12; display: flex; align-items: center;">
                    Short-Term Properties
                  </div>
                  <div 
                    v-for="day in daysInActiveMonth" 
                    :key="day.getTime()" 
                    class="timeline-cell day-col" 
                    :class="{ 'is-weekend': day.getDay() === 0 || day.getDay() === 6 }"
                    :data-date="day.toISOString().slice(0, 10)"
                    style="width: 45px; min-width: 45px; text-align: center; padding: 0.75rem 0; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; align-items: center; justify-content: center;"
                    :style="isToday(day) ? 'background-color: #eff6ff; font-weight: 800;' : ''"
                  >
                    <span 
                      :style="isToday(day) ? 'background-color: var(--accent); color: var(--primary); border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 2px 4px rgba(0,0,0,0.1);' : ''"
                    >
                      {{ day.getDate() }}
                    </span>
                    <span style="font-size: 0.55rem; font-weight: 500; text-transform: uppercase; color: #64748b; margin-top: 0.1rem;" :style="isToday(day) ? 'color: var(--accent); font-weight: 700;' : ''">
                      {{ day.toLocaleDateString('en-US', { weekday: 'narrow' }) }}
                    </span>
                  </div>
                </div>

                <!-- Property Rows -->
                <div 
                  v-for="prop in filteredTimelineProperties" 
                  :key="prop.id" 
                  class="timeline-row property-row" 
                  style="display: flex; border-bottom: 1px solid #e5e7eb; min-height: 85px;"
                >
                  <!-- Sticky left column with property details & management -->
                  <div 
                    class="timeline-cell property-col" 
                    draggable="true"
                    @dragstart="dragStart($event, prop.id)"
                    @dragover.prevent
                    @dragenter="$event.currentTarget.style.backgroundColor = '#f1f5f9'"
                    @dragleave="$event.currentTarget.style.backgroundColor = 'white'"
                    @dragend="$event.currentTarget.style.backgroundColor = 'white'"
                    @drop="dropRow($event, prop.id); $event.currentTarget.style.backgroundColor = 'white'"
                    style="width: 220px; min-width: 220px; padding: 0.75rem 1rem; position: sticky; left: 0; background: white; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; justify-content: space-between; z-index: 10; box-shadow: 2px 0 5px rgba(0,0,0,0.02); transition: background-color 0.2s; cursor: grab;"
                  >
                    <div @click="openPropertyFullPage(prop)" style="margin-bottom: 0.25rem; cursor: pointer;">
                      <strong style="color: var(--primary); font-size: 0.9rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" :title="prop.title">
                        {{ prop.title }}
                      </strong>
                      <small class="text-muted" style="font-size: 0.75rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #6b7280;" :title="prop.address">
                        {{ prop.address || 'No Address' }}
                      </small>
                    </div>
                    
                    <div style="display: flex; gap: 0.25rem; margin-top: auto;">

                      <button @click="startEditConcierge(prop)" class="edit-btn" style="padding: 2px 6px; font-size: 0.7rem;">
                        Edit
                      </button>
                      <button @click="deleteConciergeProperty(prop.id)" class="delete-btn" style="padding: 2px 6px; font-size: 0.7rem;">
                        Delete
                      </button>
                    </div>
                  </div>

                  <!-- Day cells -->
                  <div 
                    v-for="day in daysInActiveMonth" 
                    :key="day.getTime()" 
                    @click="handleDayCellClick(prop, day)"
                    @mouseenter="handleDayCellMouseEnter(prop, day)"
                    class="timeline-cell day-col" 
                    :class="{ 'is-weekend': day.getDay() === 0 || day.getDay() === 6 }"
                    style="width: 45px; min-width: 45px; border-right: 1px solid #f3f4f6; position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;"
                    :style="isCellSelected(prop, day) ? 'background-color: rgba(245, 158, 11, 0.3) !important; outline: 1px solid var(--accent); z-index: 5;' : (isToday(day) ? 'background-color: #eff6ff;' : 'background-color: white;')"
                  >
                    <!-- Booking pill bar overlay -->
                    <div 
                      v-for="state in getBookingsForDay(prop, day)"
                      :key="state.booking.id"
                      class="booking-pill-bar"
                      :class="{
                        'booking-start': state.isStart,
                        'booking-end': state.isEnd
                      }"
                      :title="`${prop.title}: ${state.booking.summary}`"
                      style="position: absolute; top: 0; bottom: 0; margin-top: auto; margin-bottom: auto; height: 36px; font-weight: 700; font-size: 0.65rem; display: flex; align-items: center; justify-content: flex-start; border-top: 1px solid rgba(255,255,255,0.2); border-bottom: 1px solid rgba(0,0,0,0.1); box-shadow: 0 1px 3px rgba(0,0,0,0.05);"
                      :style="getBookingBarStyle(state.booking, state.isStart, state.isEnd, getBookingsForDay(prop, day))"
                    >
                      <!-- Display guest name / summary only on start or in center to avoid cluttering -->
                      <span 
                        v-if="state.isStart" 
                        style="padding: 0 10px; pointer-events: none; font-size: 0.72rem; font-weight: 700; white-space: nowrap; position: absolute; left: 0; z-index: 4;"
                      >
                        {{ state.booking.summary }}
                      </span>
                    </div>
                  </div>
                </div>

                <div v-if="filteredTimelineProperties.length === 0" style="padding: 3rem; text-align: center; color: #9ca3af; font-weight: 600;">
                  <span v-if="conciergeProperties.length === 0">No short-term properties added. Click "Add Short-Term Property" above to get started.</span>
                  <span v-else>No properties match your filter selection. <a @click="clearTimelineProperties" style="color: var(--accent); cursor: pointer; text-decoration: underline;">Clear selection</a> to show all.</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Cleaning Report View -->
        <div v-else-if="currentConciergeView === 'cleaning-report'" class="concierge-dashboard">
          <section class="admin-section card" style="padding: 1.5rem;">

            <!-- Filters -->
            <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.75rem; padding-bottom: 1.25rem; border-bottom: 2px solid #f3f4f6;">
              <div>
                <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem; letter-spacing: 0.05em;">Year</label>
                <select v-model.number="cleaningReportYear" style="padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; color: var(--primary); background: #fff; min-width: 100px;">
                  <option v-for="y in Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i)" :key="y" :value="y">{{ y }}</option>
                </select>
              </div>
              <div>
                <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem; letter-spacing: 0.05em;">Month</label>
                <select v-model.number="cleaningReportMonth" style="padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; color: var(--primary); background: #fff; min-width: 120px;">
                  <option value="1">January</option><option value="2">February</option><option value="3">March</option>
                  <option value="4">April</option><option value="5">May</option><option value="6">June</option>
                  <option value="7">July</option><option value="8">August</option><option value="9">September</option>
                  <option value="10">October</option><option value="11">November</option><option value="12">December</option>
                </select>
              </div>
              <div>
                <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem; letter-spacing: 0.05em;">Cleaner</label>
                <select v-model="cleaningReportCleanerId" style="padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; color: var(--primary); background: #fff; min-width: 160px;">
                  <option value="">All Cleaners</option>
                  <option v-for="c in cleaners" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
              <div style="margin-left: auto; font-size: 0.85rem; color: #6b7280; text-align: right; display: flex; align-items: center; gap: 1rem;">
                <button 
                  @click="showTransactionsManager = true" 
                  class="action-header-btn secondary-btn"
                  style="padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem;"
                >
                  <span class="material-icons-outlined">add_circle_outline</span>
                  Add Expense / Advance
                </button>
                <div>
                  <span v-if="filteredCleaningAssignmentsList.length === 0">No cleaning assignments found.</span>
                  <span v-else>Found {{ filteredCleaningAssignmentsList.length }} assignment(s)</span>
                </div>
              </div>
            </div>

            <!-- No data state -->
            <div v-if="filteredCleaningAssignmentsList.length === 0" style="text-align: center; padding: 4rem 2rem; color: #9ca3af;">
              <span class="material-icons-outlined" style="font-size: 3.5rem; display: block; margin-bottom: 0.75rem; color: #cbd5e1;">cleaning_services</span>
              <p style="margin: 0; font-size: 1rem; font-weight: 600; color: #64748b;">No cleaning assignments recorded for this period.</p>
              <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: #94a3b8;">Try changing the date filters or assign cleanings first.</p>
            </div>

            <div v-else>
              <!-- SALARY SUMMARY TABLE -->
              <div style="margin-bottom: 2.5rem;">
                <h3 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; color: #334155; margin: 0 0 0.75rem 0; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                  <span class="material-icons-outlined" style="font-size: 1.15rem; color: #0284c7;">payments</span>
                  Payroll & Bookkeeping Summary
                </h3>
                <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow-x: auto; overflow-y: visible; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);">
                  <table style="width: 100%; min-width: 900px; border-collapse: collapse; font-size: 0.875rem;">
                    <thead>
                      <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Cleaner</th>
                        <th style="padding: 0.75rem 1rem; text-align: center; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Cleanings</th>
                        <th style="padding: 0.75rem 1rem; text-align: center; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Hours</th>
                        <th style="padding: 0.75rem 1rem; text-align: center; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Wages</th>
                        <th style="padding: 0.75rem 1rem; text-align: center; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #2563eb; letter-spacing: 0.05em;">Other Exp</th>
                        <th style="padding: 0.75rem 1rem; text-align: center; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #059669; letter-spacing: 0.05em;">Market</th>
                        <th style="padding: 0.75rem 1rem; text-align: center; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #0d9488; letter-spacing: 0.05em;">Laundry</th>
                        <th style="padding: 0.75rem 1rem; text-align: center; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #dc2626; letter-spacing: 0.05em;">Advances</th>
                        <th style="padding: 0.75rem 1rem; text-align: right; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #059669; letter-spacing: 0.05em;">Net Payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(sum, idx) in cleanerSalarySummary" :key="sum.cleaner.id" :style="{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }" style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.75rem 1rem; font-weight: 700; color: #1e293b;">
                          {{ sum.cleaner.name }}
                        </td>
                        <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 600; color: #475569;">
                          {{ sum.cleaningsCount }}
                        </td>
                        <td style="padding: 0.75rem 1rem; text-align: center; color: #475569; font-weight: 500;">
                          {{ sum.totalHours }} hrs
                        </td>
                        <td style="padding: 0.75rem 1rem; text-align: center; color: #374151; font-weight: 600;">
                          €{{ sum.wage.toFixed(2) }}
                        </td>
                        <td style="padding: 0.75rem 1rem; text-align: center; color: #2563eb; font-weight: 600;">
                          €{{ sum.otherExpenses.toFixed(2) }}
                        </td>
                        <td style="padding: 0.75rem 1rem; text-align: center; color: #059669; font-weight: 600;">
                          €{{ sum.marketExpenses.toFixed(2) }}
                        </td>
                        <td style="padding: 0.75rem 1rem; text-align: center; color: #0d9488; font-weight: 600;">
                          €{{ sum.laundryExpenses.toFixed(2) }}
                        </td>
                        <td style="padding: 0.75rem 1rem; text-align: center; color: #dc2626; font-weight: 600;">
                          €{{ sum.advances.toFixed(2) }}
                        </td>
                        <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 800; color: #059669; font-size: 1.05rem;">
                          €{{ sum.netPayout.toFixed(2) }}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr style="background: #f8fafc; font-weight: 800; border-top: 1px solid #cbd5e1;">
                        <td style="padding: 0.85rem 1rem; color: #334155;">Total for current view</td>
                        <td style="padding: 0.85rem 1rem; text-align: center; color: #334155;">
                          {{ cleanerSalarySummary.reduce((s, r) => s + r.cleaningsCount, 0) }} cleanings
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: center; color: #334155;">
                          {{ cleanerSalarySummary.reduce((s, r) => s + r.totalHours, 0) }} hrs
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: center; color: #334155;">
                          €{{ cleanerSalarySummary.reduce((s, r) => s + r.wage, 0).toFixed(2) }}
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: center; color: #2563eb;">
                          €{{ cleanerSalarySummary.reduce((s, r) => s + r.otherExpenses, 0).toFixed(2) }}
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: center; color: #059669;">
                          €{{ cleanerSalarySummary.reduce((s, r) => s + r.marketExpenses, 0).toFixed(2) }}
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: center; color: #0d9488;">
                          €{{ cleanerSalarySummary.reduce((s, r) => s + r.laundryExpenses, 0).toFixed(2) }}
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: center; color: #dc2626;">
                          €{{ cleanerSalarySummary.reduce((s, r) => s + r.advances, 0).toFixed(2) }}
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: right; color: #059669; font-size: 1.1rem;">
                          €{{ cleanerSalarySummary.reduce((s, r) => s + r.netPayout, 0).toFixed(2) }}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <!-- DETAILED CLEANING BREAKDOWN -->
              <div>
                <h3 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; color: #334155; margin: 2.5rem 0 0.75rem 0; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                  <span class="material-icons-outlined" style="font-size: 1.15rem; color: #0284c7;">list</span>
                  Detailed Cleaning Breakdown
                </h3>
                <div class="cleaning-report-table-wrap">
                  <table class="cleaning-report-table" style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                    <thead>
                      <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 0.6rem 0.75rem; text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; white-space: nowrap;">Date</th>
                        <th style="padding: 0.6rem 0.75rem; text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; white-space: nowrap;">Cleaner</th>
                        <th style="padding: 0.6rem 0.75rem; text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Property</th>
                        <th style="padding: 0.6rem 0.75rem; text-align: center; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; white-space: nowrap;">Duration</th>
                        <th style="padding: 0.6rem 0.75rem; text-align: center; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; white-space: nowrap;">Rate</th>
                        <th style="padding: 0.6rem 0.75rem; text-align: center; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; white-space: nowrap;">Wage</th>
                        <th style="padding: 0.6rem 0.75rem; text-align: center; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #7c3aed; letter-spacing: 0.04em; white-space: nowrap;">Other</th>
                        <th style="padding: 0.6rem 0.75rem; text-align: center; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #059669; letter-spacing: 0.04em; white-space: nowrap;">Market</th>
                        <th style="padding: 0.6rem 0.75rem; text-align: center; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #0d9488; letter-spacing: 0.04em; white-space: nowrap;">Laundry</th>
                        <th style="padding: 0.6rem 0.75rem; text-align: center; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #0284c7; letter-spacing: 0.04em; white-space: nowrap;">Airbnb Fee</th>
                        <th style="padding: 0.6rem 0.75rem; text-align: right; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; white-space: nowrap;">Total</th>
                        <th class="cleaning-report-actions-head" style="padding: 0.6rem 0.75rem; text-align: center; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; white-space: nowrap;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, idx) in filteredCleaningAssignmentsList" :key="row.id" :style="{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }" style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.6rem 0.75rem; color: #374151; font-weight: 600; white-space: nowrap; font-size: 0.82rem;">
                          {{ new Date(row.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                        </td>
                        <td style="padding: 0.6rem 0.75rem; font-weight: 700; color: #1e293b; white-space: nowrap; font-size: 0.85rem;">
                          {{ row.cleaner_name }}
                        </td>
                        <td style="padding: 0.6rem 0.75rem; min-width: 130px;">
                          <div style="font-weight: 600; color: var(--primary); font-size: 0.85rem;">{{ row.property_title }}</div>
                          <div v-if="row.notes" style="font-size: 0.72rem; color: #6b7280; font-style: italic; margin-top: 0.15rem; display: flex; align-items: center; gap: 0.2rem;">
                            <span class="material-icons-outlined" style="font-size: 0.8rem; color: #94a3b8;">chat_bubble_outline</span>
                            {{ row.notes }}
                          </div>
                        </td>
                        <td style="padding: 0.6rem 0.75rem; text-align: center; color: #334155; font-weight: 500; font-size: 0.85rem; white-space: nowrap;">
                          <span v-if="row.duration > 0">{{ row.duration }} h</span>
                          <span v-else style="color: #cbd5e1;">—</span>
                        </td>
                        <td style="padding: 0.6rem 0.75rem; text-align: center; color: #374151; font-weight: 500; font-size: 0.85rem; white-space: nowrap;">
                          <span v-if="row.rate > 0">€{{ row.rate.toFixed(2) }}/h</span>
                          <span v-else style="color: #cbd5e1;">—</span>
                        </td>
                        <td style="padding: 0.6rem 0.75rem; text-align: center; color: #374151; font-weight: 600; font-size: 0.85rem; white-space: nowrap;">
                          €{{ row.wage.toFixed(2) }}
                        </td>
                        <td style="padding: 0.6rem 0.75rem; text-align: center; color: #7c3aed; font-weight: 600; font-size: 0.85rem; white-space: nowrap;">
                          <span v-if="row.other_expense > 0">€{{ row.other_expense.toFixed(2) }}</span>
                          <span v-else style="color: #cbd5e1;">—</span>
                        </td>
                        <td style="padding: 0.6rem 0.75rem; text-align: center; color: #059669; font-weight: 600; font-size: 0.85rem; white-space: nowrap;">
                          <span v-if="row.market_expense > 0">€{{ row.market_expense.toFixed(2) }}</span>
                          <span v-else style="color: #cbd5e1;">—</span>
                        </td>
                        <td style="padding: 0.6rem 0.75rem; text-align: center; color: #0d9488; font-weight: 600; font-size: 0.85rem; white-space: nowrap;">
                          <span v-if="row.laundry_expense > 0">€{{ row.laundry_expense.toFixed(2) }}</span>
                          <span v-else style="color: #cbd5e1;">—</span>
                        </td>
                        <td style="padding: 0.6rem 0.75rem; text-align: center; color: #0284c7; font-weight: 600; font-size: 0.85rem; white-space: nowrap;">
                          <span v-if="row.airbnb_fee > 0">€{{ row.airbnb_fee.toFixed(2) }}</span>
                          <span v-else style="color: #cbd5e1;">—</span>
                        </td>
                        <td style="padding: 0.6rem 0.75rem; text-align: right; font-weight: 800; font-size: 0.85rem; white-space: nowrap;" :style="{ color: row.total_cost > 0 ? (row.total_cost > row.airbnb_fee ? '#dc2626' : '#059669') : '#94a3b8' }">
                          <span v-if="row.total_cost > 0">€{{ row.total_cost.toFixed(2) }}</span>
                          <span v-else style="font-size: 0.78rem; color: #cbd5e1;">N/A</span>
                        </td>
                        <td class="cleaning-report-actions-cell">
                          <button @click="startEditCleaningAssignment(row)" class="edit-btn cleaning-report-edit-btn" title="Edit" aria-label="Edit cleaning assignment">
                            <span class="material-icons-outlined">edit</span>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr style="background: #f8fafc; font-weight: 800; border-top: 1px solid #cbd5e1;">
                        <td colspan="3" style="padding: 0.7rem 0.75rem; color: #334155; font-size: 0.82rem;">Total for current view</td>
                        <td style="padding: 0.7rem 0.75rem; text-align: center; color: #334155; font-size: 0.82rem;">
                          {{ filteredCleaningAssignmentsList.reduce((s, r) => s + r.duration, 0) }} h
                        </td>
                        <td></td>
                        <td style="padding: 0.7rem 0.75rem; text-align: center; color: #334155; font-size: 0.82rem;">
                          €{{ filteredCleaningAssignmentsList.reduce((s, r) => s + r.wage, 0).toFixed(2) }}
                        </td>
                        <td style="padding: 0.7rem 0.75rem; text-align: center; color: #7c3aed; font-size: 0.82rem;">
                          €{{ filteredCleaningAssignmentsList.reduce((s, r) => s + r.other_expense, 0).toFixed(2) }}
                        </td>
                        <td style="padding: 0.7rem 0.75rem; text-align: center; color: #059669; font-size: 0.82rem;">
                          €{{ filteredCleaningAssignmentsList.reduce((s, r) => s + r.market_expense, 0).toFixed(2) }}
                        </td>
                        <td style="padding: 0.7rem 0.75rem; text-align: center; color: #0d9488; font-size: 0.82rem;">
                          €{{ filteredCleaningAssignmentsList.reduce((s, r) => s + r.laundry_expense, 0).toFixed(2) }}
                        </td>
                        <td style="padding: 0.7rem 0.75rem; text-align: center; color: #0284c7; font-size: 0.82rem;">
                          €{{ filteredCleaningAssignmentsList.reduce((s, r) => s + r.airbnb_fee, 0).toFixed(2) }}
                        </td>
                        <td style="padding: 0.7rem 0.75rem; text-align: right; color: #059669; font-size: 0.95rem;">
                          €{{ filteredCleaningAssignmentsList.reduce((s, r) => s + r.total_cost, 0).toFixed(2) }}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

              <!-- 2. EXPENSES & ADVANCES MANAGEMENT MODAL (Add form only) -->
              <div v-if="showTransactionsManager" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1.5rem;" @click.self="showTransactionsManager = false">
                <div style="background: white; border-radius: 16px; width: 100%; max-width: 450px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; display: flex; flex-direction: column;">
                  <!-- Modal Header -->
                  <div style="padding: 1.25rem 1.5rem; background: #1e293b; color: white; display: flex; align-items: center; justify-content: space-between;">
                    <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                      <span class="material-icons-outlined">payments</span>
                      Add Expense / Advance
                    </h3>
                    <button @click="showTransactionsManager = false" style="background: none; border: none; color: #94a3b8; cursor: pointer; display: flex; align-items: center; transition: color 0.15s;" @mouseenter="$event.target.style.color='#fff'" @mouseleave="$event.target.style.color='#94a3b8'">
                      <span class="material-icons-outlined" style="font-size: 1.5rem;">close</span>
                    </button>
                  </div>
                  
                  <!-- Modal Content -->
                  <div style="padding: 1.5rem;">
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                      <div>
                        <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Cleaner *</label>
                        <select v-model="newTransactionForm.cleaner_id" style="padding: 0.65rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%; background: #fff;">
                          <option value="" disabled selected>Select Cleaner</option>
                          <option v-for="c in cleaners" :key="c.id" :value="c.id">{{ c.name }}</option>
                        </select>
                      </div>

                      <div>
                        <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Transaction Type *</label>
                        <select v-model="newTransactionForm.type" style="padding: 0.65rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%; background: #fff;">
                          <option value="expense">Other Expense</option>
                          <option value="market">Market Expense</option>
                          <option value="laundry">Laundry Expense</option>
                          <option value="advance">Salary Advance</option>
                        </select>
                      </div>

                      <div v-if="['expense', 'market', 'laundry'].includes(newTransactionForm.type)">
                        <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Property / Flat (Optional)</label>
                        <select v-model="newTransactionForm.property_id" style="padding: 0.65rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%; background: #fff;">
                          <option value="">No Property / General Expense</option>
                          <option v-for="p in conciergeProperties" :key="p.id" :value="p.id">{{ p.title }}</option>
                        </select>
                      </div>

                      <div>
                        <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Amount (€) *</label>
                        <input v-model.number="newTransactionForm.amount" type="number" min="0" step="0.01" placeholder="0.00" style="padding: 0.65rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                      </div>

                      <div>
                        <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Date *</label>
                        <input v-model="newTransactionForm.transaction_date" type="date" style="padding: 0.65rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                      </div>

                      <div>
                        <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Description / Notes</label>
                        <input v-model="newTransactionForm.description" type="text" placeholder="e.g. Detergent, Laundry tokens..." style="padding: 0.65rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                      </div>

                      <button @click="addCleanerTransaction" class="submit-btn" style="width: 100%; justify-content: center; padding: 0.75rem; margin-top: 0.5rem; font-weight: 700;">
                        <span class="material-icons-outlined" style="font-size: 1.15rem; margin-right: 0.35rem;">add_circle_outline</span>
                        Save Transaction
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            <!-- Edit Assignment Modal Overlay -->
            <transition name="fade">
              <div v-if="showEditAssignmentModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1.5rem;" @click.self="showEditAssignmentModal = false">
                <div style="background: white; border-radius: 16px; width: 100%; max-width: 450px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; display: flex; flex-direction: column;">
                  <!-- Modal Header -->
                  <div style="padding: 1.25rem 1.5rem; background: #0284c7; color: white; display: flex; align-items: center; justify-content: space-between;">
                    <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                      <span class="material-icons-outlined">edit</span>
                      Edit Cleaning Assignment
                    </h3>
                    <button @click="showEditAssignmentModal = false" style="background: none; border: none; color: #bae6fd; cursor: pointer; display: flex; align-items: center; transition: color 0.15s;" @mouseenter="$event.target.style.color='#fff'" @mouseleave="$event.target.style.color='#bae6fd'">
                      <span class="material-icons-outlined" style="font-size: 1.5rem;">close</span>
                    </button>
                  </div>
                  
                  <!-- Modal Content -->
                  <div style="padding: 1.5rem; max-height: 80vh; overflow-y: auto;">
                    <form @submit.prevent="saveEditedCleaningAssignment" style="display: flex; flex-direction: column; gap: 1rem;">

                      <!-- Core Assignment Fields -->
                      <div>
                        <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Select Cleaner *</label>
                        <select v-model="editAssignmentForm.cleaner_id" required style="padding: 0.65rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%; background: #fff; font-weight: 600;">
                          <option v-for="c in cleaners" :key="c.id" :value="c.id">{{ c.name }}</option>
                        </select>
                      </div>

                      <div>
                        <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Cleaning Duration (hours) *</label>
                        <input v-model.number="editAssignmentForm.max_cleaning_duration" type="number" min="0.1" step="0.1" required style="padding: 0.65rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%; font-weight: 700;" />
                      </div>

                      <div>
                        <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Hourly Rate (€/hr) *</label>
                        <input v-model.number="editAssignmentForm.hourly_rate" type="number" min="0" step="0.01" required style="padding: 0.65rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                      </div>

                      <div>
                        <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Airbnb Cleaning Fee (€) *</label>
                        <input v-model.number="editAssignmentForm.airbnb_cleaning_fee" type="number" min="0" step="0.01" required style="padding: 0.65rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                      </div>

                      <div>
                        <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Notes</label>
                        <input v-model="editAssignmentForm.notes" type="text" placeholder="Add optional details..." style="padding: 0.65rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                      </div>

                      <!-- Expense / Advance Section -->
                      <div style="border-top: 1.5px dashed #e2e8f0; padding-top: 1rem; margin-top: 0.25rem;">
                        <p style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #475569; margin: 0 0 0.75rem 0; display: flex; align-items: center; gap: 0.4rem;">
                          <span class="material-icons-outlined" style="font-size: 1rem; color: #0284c7;">receipt_long</span>
                          Expenses &amp; Advance (will be saved as transactions)
                        </p>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                          <div>
                            <label style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #059669; display: block; margin-bottom: 0.3rem;">
                              <span class="material-icons-outlined" style="font-size: 0.85rem; vertical-align: middle;">shopping_cart</span>
                              Market (€)
                            </label>
                            <input v-model.number="editAssignmentForm.market_amount" type="number" min="0" step="0.01" placeholder="0.00" style="padding: 0.6rem; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 0.9rem; width: 100%; background: #f0fdf4;" />
                          </div>
                          <div>
                            <label style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #0d9488; display: block; margin-bottom: 0.3rem;">
                              <span class="material-icons-outlined" style="font-size: 0.85rem; vertical-align: middle;">local_laundry_service</span>
                              Laundry (€)
                            </label>
                            <input v-model.number="editAssignmentForm.laundry_amount" type="number" min="0" step="0.01" placeholder="0.00" style="padding: 0.6rem; border: 1px solid #99f6e4; border-radius: 8px; font-size: 0.9rem; width: 100%; background: #f0fdfa;" />
                          </div>
                        </div>

                        <div style="margin-top: 0.75rem;">
                          <label style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #dc2626; display: block; margin-bottom: 0.3rem;">
                            <span class="material-icons-outlined" style="font-size: 0.85rem; vertical-align: middle;">payments</span>
                            Advance Paid (€)
                          </label>
                          <input v-model.number="editAssignmentForm.advance_amount" type="number" min="0" step="0.01" placeholder="0.00" style="padding: 0.6rem; border: 1px solid #fecaca; border-radius: 8px; font-size: 0.9rem; width: 100%; background: #fff5f5;" />
                        </div>

                        <div style="margin-top: 0.75rem;">
                          <label style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.3rem;">Description / Note (applies to all above)</label>
                          <input v-model="editAssignmentForm.expense_description" type="text" placeholder="e.g. Detergent, advance for transport..." style="padding: 0.6rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.85rem; width: 100%;" />
                        </div>
                      </div>

                      <button type="submit" class="submit-btn" style="width: 100%; justify-content: center; padding: 0.75rem; margin-top: 0.5rem; font-weight: 700; background-color: #0284c7; border-color: #0284c7;">
                        <span class="material-icons-outlined" style="font-size: 1.15rem; margin-right: 0.35rem;">save</span>
                        Save Changes
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </transition>

          </section>
        </div>

        <!-- Cleaner Wage Payments View -->
        <div v-else-if="currentConciergeView === 'cleaner-payments' && isSuperuser" class="concierge-dashboard">
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            
            <!-- Header Row with Title and Button -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 1rem;">
              <h2 style="font-size: 1.35rem; color: var(--primary); font-weight: 800; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                <span class="material-icons-outlined" style="color: #2563eb;">account_balance_wallet</span>
                Cleaner Wage Payments
              </h2>
              <button 
                @click="showAddPaymentModal = true" 
                class="action-header-btn" 
                style="background-color: #10b981; color: white; font-weight: 700; padding: 0.5rem 1.25rem;"
              >
                <span class="material-icons-outlined">add_card</span>
                Record Payment
              </button>
            </div>

            <!-- Cleaner Balances Table Card -->
            <div class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
              <h3 style="font-size: 1rem; color: var(--primary); font-weight: 700; margin: 0 0 1.25rem 0; display: flex; align-items: center; gap: 0.5rem;">
                <span class="material-icons-outlined" style="color: #2563eb;">account_balance_wallet</span>
                Accumulated Payroll Balances (Cumulative)
              </h3>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
                  <thead>
                    <tr style="border-bottom: 2px solid #f3f4f6; background-color: #f9fafb; color: #4b5563; font-weight: 700;">
                      <th style="padding: 10px;">Cleaner</th>
                      <th style="padding: 10px; text-align: right;">Total Wages</th>
                      <th style="padding: 10px; text-align: right;">Total Expenses</th>
                      <th style="padding: 10px; text-align: right;">Total Advances</th>
                      <th style="padding: 10px; text-align: right; color: #16a34a;">Total Paid</th>
                      <th style="padding: 10px; text-align: right; font-weight: 800; color: var(--primary);">Current Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="b in cleanerCumulativeBalances" :key="b.cleaner.id" style="border-bottom: 1px solid #f3f4f6;" class="hover-row">
                      <td style="padding: 10px; font-weight: 700; color: var(--primary);">
                        {{ b.cleaner.name }}
                      </td>
                      <td style="padding: 10px; text-align: right; color: #374151;">
                        €{{ b.totalWages.toFixed(2) }}
                      </td>
                      <td style="padding: 10px; text-align: right; color: #2563eb;">
                        €{{ b.totalExpenses.toFixed(2) }}
                      </td>
                      <td style="padding: 10px; text-align: right; color: #dc2626;">
                        €{{ b.totalAdvances.toFixed(2) }}
                      </td>
                      <td style="padding: 10px; text-align: right; font-weight: 700; color: #16a34a;">
                        €{{ b.totalPaid.toFixed(2) }}
                      </td>
                      <td style="padding: 10px; text-align: right; font-weight: 800; font-size: 0.95rem;" :style="{ color: b.accumulatedBalance > 0.01 ? '#d97706' : (b.accumulatedBalance < -0.01 ? '#2563eb' : '#16a34a') }">
                        €{{ b.accumulatedBalance.toFixed(2) }}
                        <div style="font-size: 0.65rem; font-weight: 600; margin-top: 0.1rem;">
                          <span v-if="b.accumulatedBalance > 0.01" style="background: #fffbeb; color: #b45309; padding: 1px 4px; border-radius: 3px;">Pending Payment</span>
                          <span v-else-if="b.accumulatedBalance < -0.01" style="background: #eff6ff; color: #1d4ed8; padding: 1px 4px; border-radius: 3px;">Overpaid</span>
                          <span v-else style="background: #f0fdf4; color: #15803d; padding: 1px 4px; border-radius: 3px;">Fully Settled</span>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="cleanerCumulativeBalances.length === 0">
                      <td colspan="6" style="text-align: center; padding: 2rem; color: #9ca3af;">No cleaner balances calculated. Add cleaners first.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Payment History Log Card -->
            <div class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
              <h3 style="font-size: 1rem; color: var(--primary); font-weight: 700; margin: 0 0 1.25rem 0; display: flex; align-items: center; gap: 0.5rem;">
                <span class="material-icons-outlined" style="color: #10b981;">history</span>
                Payment History Log
              </h3>

              <!-- Filters Row -->
              <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; background: #f8fafc; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
                <!-- Cleaner Filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <label style="font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase;">Cleaner:</label>
                  <select v-model="paymentFilterCleanerId" style="padding: 0.35rem 0.5rem; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 0.82rem; color: #334155; font-weight: 600; cursor: pointer; outline: none;">
                    <option value="">All Cleaners</option>
                    <option v-for="c in cleaners" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                </div>
                <!-- Year Filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <label style="font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase;">Year:</label>
                  <select v-model="paymentFilterYear" style="padding: 0.35rem 0.5rem; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 0.82rem; color: #334155; font-weight: 600; cursor: pointer; outline: none;">
                    <option value="all">All Years</option>
                    <option v-for="y in [2024, 2025, 2026, 2027, 2028, 2029, 2030]" :key="y" :value="y">{{ y }}</option>
                  </select>
                </div>
                <!-- Month Filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <label style="font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase;">Month:</label>
                  <select v-model="paymentFilterMonth" style="padding: 0.35rem 0.5rem; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 0.82rem; color: #334155; font-weight: 600; cursor: pointer; outline: none;">
                    <option value="all">All Months</option>
                    <option value="0">January</option>
                    <option value="1">February</option>
                    <option value="2">March</option>
                    <option value="3">April</option>
                    <option value="4">May</option>
                    <option value="5">June</option>
                    <option value="6">July</option>
                    <option value="7">August</option>
                    <option value="8">September</option>
                    <option value="9">October</option>
                    <option value="10">November</option>
                    <option value="11">December</option>
                  </select>
                </div>
                <!-- Clear Filters Button -->
                <button 
                  v-if="paymentFilterCleanerId || paymentFilterYear !== 'all' || paymentFilterMonth !== 'all'"
                  @click="paymentFilterCleanerId = ''; paymentFilterYear = 'all'; paymentFilterMonth = 'all';"
                  style="padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; background: white; cursor: pointer; color: #dc2626; font-weight: 700; transition: all 0.2s;"
                  @mouseenter="$event.target.style.backgroundColor='#fef2f2'"
                  @mouseleave="$event.target.style.backgroundColor='white'"
                >
                  Clear Filters
                </button>
              </div>

              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
                  <thead>
                    <tr style="border-bottom: 2px solid #f3f4f6; background-color: #f9fafb; color: #4b5563; font-weight: 700;">
                      <th style="padding: 10px;">Date</th>
                      <th style="padding: 10px;">Cleaner</th>
                      <th style="padding: 10px;">Payment Details</th>
                      <th style="padding: 10px; text-align: right; color: #10b981;">Amount Paid</th>
                      <th style="padding: 10px; text-align: center;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="t in filteredPaymentsHistory" :key="t.id" style="border-bottom: 1px solid #f3f4f6;" class="hover-row">
                      <td style="padding: 10px; font-weight: 600; color: #374151;">
                        {{ new Date(t.transaction_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                      </td>
                      <td style="padding: 10px; font-weight: 700; color: var(--primary);">
                        {{ cleaners.find(c => c.id === t.cleaner_id)?.name || '—' }}
                      </td>
                      <td style="padding: 10px; color: #4b5563;">
                        {{ t.description || 'Bank Transfer' }}
                      </td>
                      <td style="padding: 10px; text-align: right; font-weight: 700; color: #10b981;">
                        €{{ parseFloat(t.amount).toFixed(2) }}
                      </td>
                      <td style="padding: 10px; text-align: center; display: flex; gap: 0.35rem; justify-content: center; align-items: center;">
                        <button @click="startEditPayment(t)" class="edit-btn" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;">
                          <span class="material-icons-outlined" style="font-size: 0.85rem;">edit</span>
                          Edit
                        </button>
                        <button @click="deleteCleanerTransaction(t.id)" class="delete-btn" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;">
                          <span class="material-icons-outlined" style="font-size: 0.85rem;">delete</span>
                          Delete
                        </button>
                      </td>
                    </tr>
                    <tr v-if="filteredPaymentsHistory.length === 0">
                      <td colspan="5" style="text-align: center; padding: 2rem; color: #9ca3af;">No payments logged matching selected filters.</td>
                    </tr>
                  </tbody>
                  <tfoot v-if="filteredPaymentsHistory.length > 0">
                    <tr style="background: #f0fdf4; font-weight: 800; border-top: 1px solid #d1fae5;">
                      <td colspan="3" style="padding: 10px; color: #15803d;">Total Filtered Payments</td>
                      <td style="padding: 10px; text-align: right; color: #16a34a; font-size: 0.9rem;">
                        €{{ filteredPaymentsHistory.reduce((s, t) => s + parseFloat(t.amount || 0), 0).toFixed(2) }}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>

          <!-- Record Payment Modal Overlay -->
          <transition name="fade">
            <div v-if="showAddPaymentModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1.5rem;" @click.self="cancelAddPayment">
              <div style="background: white; border-radius: 16px; width: 100%; max-width: 450px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; display: flex; flex-direction: column;">
                <!-- Modal Header -->
                <div style="padding: 1.25rem 1.5rem; background: #10b981; color: white; display: flex; align-items: center; justify-content: space-between;">
                  <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-outlined">add_card</span>
                    {{ isEditingPayment ? 'Edit Wage Payment' : 'Record Wage Payment' }}
                  </h3>
                  <button @click="cancelAddPayment" style="background: none; border: none; color: #a7f3d0; cursor: pointer; display: flex; align-items: center; transition: color 0.15s;" @mouseenter="$event.target.style.color='#fff'" @mouseleave="$event.target.style.color='#a7f3d0'">
                    <span class="material-icons-outlined" style="font-size: 1.5rem;">close</span>
                  </button>
                </div>
                
                <!-- Modal Content -->
                <div style="padding: 1.5rem;">
                  <form @submit.prevent="addCleanerPayment" style="display: flex; flex-direction: column; gap: 1rem;">
                    <div>
                      <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Select Cleaner *</label>
                      <select v-model="paymentForm.cleaner_id" required style="padding: 0.65rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%; background: #fff; font-weight: 600;">
                        <option value="" disabled selected>— Select Cleaner —</option>
                        <option v-for="c in cleaners" :key="c.id" :value="c.id">{{ c.name }}</option>
                      </select>
                    </div>

                    <div>
                      <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Payment Date *</label>
                      <input v-model="paymentForm.transaction_date" type="date" required style="padding: 0.65rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                    </div>

                    <div>
                      <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Payment Method *</label>
                      <select v-model="paymentForm.description" required style="padding: 0.65rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%; background: #fff; font-weight: 600;">
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cash Payment">Cash Payment</option>
                      </select>
                    </div>

                    <div>
                      <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Amount (€) *</label>
                      <input v-model.number="paymentForm.amount" type="number" min="0.01" step="0.01" placeholder="0.00" required style="padding: 0.65rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%; font-weight: 700;" />
                    </div>

                    <div>
                      <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 0.35rem;">Additional Notes (Optional)</label>
                      <input v-model="paymentForm.notes" type="text" placeholder="e.g. Reference number, invoice ref..." style="padding: 0.65rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                    </div>

                    <button type="submit" class="submit-btn" style="width: 100%; justify-content: center; padding: 0.75rem; margin-top: 0.5rem; font-weight: 700; background-color: #10b981; border-color: #10b981;">
                      <span class="material-icons-outlined" style="font-size: 1.15rem; margin-right: 0.35rem;">check_circle</span>
                      {{ isEditingPayment ? 'Save Changes' : 'Log Payment' }}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <!-- Reports Tracking View -->
        <div v-else-if="currentConciergeView === 'reports-tracking'" class="concierge-dashboard">
          <section class="admin-section card" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 2px solid #f3f4f6; padding-bottom: 0.75rem;">
              <div>
                <h2 style="font-size: 1.25rem; color: var(--primary); font-weight: 700; margin: 0;">
                  Property Owner Reports Tracking
                </h2>
                <small style="color: #6b7280; font-size: 0.8rem;">Monitor which monthly reports have been emailed to owners.</small>
              </div>
              <button 
                @click="fetchConciergeReports"
                style="padding: 0.5rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.8rem; background: white; color: #374151; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 0.35rem;"
              >
                <span class="material-icons-outlined" style="font-size: 0.95rem;">refresh</span>
                Refresh Status
              </button>
            </div>

            <!-- Filters & Page Size Controls -->
            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; background: #f8fafc; padding: 1rem; border-radius: 8px;">
              <!-- Search Input -->
              <div style="flex: 1; min-width: 200px; display: flex; align-items: center; position: relative;">
                <span class="material-icons-outlined" style="position: absolute; left: 0.75rem; color: #94a3b8; font-size: 1.2rem;">search</span>
                <input 
                  type="text" 
                  v-model="reportsFilter.search" 
                  placeholder="Search by property, owner name..."
                  style="width: 100%; padding: 0.5rem 1rem 0.5rem 2.5rem; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.88rem; outline: none; background: white;"
                />
              </div>

              <!-- Status Dropdown -->
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-size: 0.85rem; font-weight: 600; color: #475569;">Status:</label>
                <select 
                  v-model="reportsFilter.status"
                  style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 0.88rem; color: #334155; font-weight: 600; cursor: pointer;"
                >
                  <option value="all">All Statuses</option>
                  <option value="sent">Sent</option>
                  <option value="not_sent">Not Sent</option>
                </select>
              </div>

              <!-- Year Filter -->
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-size: 0.85rem; font-weight: 600; color: #475569;">Year:</label>
                <select 
                  v-model.number="reportsFilter.year"
                  style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 0.88rem; color: #334155; font-weight: 600; cursor: pointer;"
                >
                  <option v-for="y in Array.from({length: 10}, (_, i) => 2024 + i)" :key="y" :value="y">{{ y }}</option>
                </select>
              </div>

              <!-- Month Filter -->
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-size: 0.85rem; font-weight: 600; color: #475569;">Month:</label>
                <select 
                  v-model.number="reportsFilter.month"
                  style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 0.88rem; color: #334155; font-weight: 600; cursor: pointer;"
                >
                  <option :value="1">January</option>
                  <option :value="2">February</option>
                  <option :value="3">March</option>
                  <option :value="4">April</option>
                  <option :value="5">May</option>
                  <option :value="6">June</option>
                  <option :value="7">July</option>
                  <option :value="8">August</option>
                  <option :value="9">September</option>
                  <option :value="10">October</option>
                  <option :value="11">November</option>
                  <option :value="12">December</option>
                </select>
              </div>

              <!-- Page Size Dropdown -->
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-size: 0.85rem; font-weight: 600; color: #475569;">Show:</label>
                <select 
                  v-model="reportsPerPage"
                  style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 0.88rem; color: #334155; font-weight: 600; cursor: pointer;"
                >
                  <option :value="10">10 rows</option>
                  <option :value="20">20 rows</option>
                  <option :value="50">50 rows</option>
                  <option :value="100">100 rows</option>
                </select>
              </div>
            </div>

            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                <thead>
                  <tr style="border-bottom: 2px solid #e5e7eb; background: #f9fafb; text-align: left; color: #4b5563; font-weight: 700;">
                    <th style="padding: 0.75rem 1rem;">Property</th>
                    <th style="padding: 0.75rem 1rem;">Owner Name</th>
                    <th style="padding: 0.75rem 1rem;">Report Period</th>
                    <th style="padding: 0.75rem 1rem; text-align: center;">Status</th>
                    <th style="padding: 0.75rem 1rem; text-align: center;">Last Emailed</th>
                    <th style="padding: 0.75rem 1rem; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="row in paginatedReportTrackingRows" 
                    :key="row.id"
                    style="border-bottom: 1px solid #f3f4f6; transition: background 0.15s;"
                    @mouseenter="$event.currentTarget.style.background='#f9fafb'"
                    @mouseleave="$event.currentTarget.style.background=''"
                  >
                    <!-- Property Name -->
                    <td style="padding: 0.75rem 1rem; font-weight: 600; color: var(--primary);">
                      {{ row.propertyTitle }}
                    </td>
                    <!-- Owner Name -->
                    <td style="padding: 0.75rem 1rem; color: #374151;">
                      <div>{{ row.ownerName }}</div>
                      <small style="color: #6b7280; font-size: 0.75rem;">{{ row.ownerEmail }}</small>
                    </td>
                    <!-- Month & Year -->
                    <td style="padding: 0.75rem 1rem; font-weight: 600; color: #4b5563;">
                      {{ row.monthName }} {{ row.year }}
                    </td>
                    <!-- Status -->
                    <td style="padding: 0.75rem 1rem; text-align: center;">
                      <span 
                        v-if="row.status === 'sent'"
                        style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; background: #d1fae5; color: #065f46;"
                      >
                        <span class="material-icons-outlined" style="font-size: 0.85rem;">check_circle</span>
                        Sent
                      </span>
                      <span 
                        v-else
                        style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; background: #fef3c7; color: #92400e;"
                      >
                        <span class="material-icons-outlined" style="font-size: 0.85rem;">pending</span>
                        Not Sent
                      </span>
                    </td>
                    <!-- Last Sent Date -->
                    <td style="padding: 0.75rem 1rem; text-align: center; color: #6b7280;">
                      {{ row.lastSentAt ? formatDateToEU(row.lastSentAt.slice(0,10)) + ' ' + row.lastSentAt.slice(11,16) : '—' }}
                    </td>
                    <!-- Action -->
                    <td style="padding: 0.75rem 1rem; text-align: right;">
                      <button 
                        @click="sendTrackingReportEmail(row)"
                        :disabled="isSendingEmail"
                        style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1.5px solid #2563eb; background: #2563eb; color: white; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;"
                      >
                        <span class="material-icons-outlined" style="font-size: 0.85rem;">mail</span>
                        Send Email
                      </button>
                    </td>
                  </tr>
                  <tr v-if="filteredReportTrackingRows.length === 0">
                    <td colspan="6" style="padding: 3rem; text-align: center; color: #9ca3af; font-weight: 600;">
                      No booking records match the filters.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination Controls -->
            <div 
              v-if="reportsTotalPages > 1"
              style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; flex-wrap: wrap; gap: 1rem;"
            >
              <div style="font-size: 0.85rem; color: #64748b;">
                Showing page {{ reportsCurrentPage }} of {{ reportsTotalPages }} ({{ filteredReportTrackingRows.length }} total rows)
              </div>
              <div style="display: flex; gap: 0.35rem; align-items: center;">
                <button 
                  @click="reportsCurrentPage = Math.max(1, reportsCurrentPage - 1)" 
                  :disabled="reportsCurrentPage === 1"
                  style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;"
                  :style="reportsCurrentPage === 1 ? 'opacity:0.5; cursor:not-allowed;' : ''"
                >
                  <span class="material-icons-outlined" style="font-size: 1rem;">chevron_left</span>
                  Prev
                </button>

                <button 
                  v-for="p in reportsTotalPages" 
                  :key="p"
                  @click="reportsCurrentPage = p"
                  style="padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;"
                  :style="p === reportsCurrentPage ? 'background: #2563eb; color: white; border: 1px solid #2563eb;' : 'background: white; color: #475569; border: 1px solid #e2e8f0;'"
                >
                  {{ p }}
                </button>

                <button 
                  @click="reportsCurrentPage = Math.min(reportsTotalPages, reportsCurrentPage + 1)" 
                  :disabled="reportsCurrentPage === reportsTotalPages"
                  style="padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;"
                  :style="reportsCurrentPage === reportsTotalPages ? 'opacity:0.5; cursor:not-allowed;' : ''"
                >
                  Next
                  <span class="material-icons-outlined" style="font-size: 1rem;">chevron_right</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        <!-- Full-Page Property Details Dashboard (commission split calculations) -->
        <div v-else-if="currentConciergeView === 'property-details'" class="property-details-dashboard" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 0.5rem;">
          
          <!-- Local Detail Page Header -->
          <div class="card" style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <button 
                @click="currentConciergeView = 'calendar'" 
                class="action-header-btn secondary-btn"
                style="padding: 0.4rem 0.75rem; font-size: 0.85rem;"
              >
                <span class="material-icons-outlined">arrow_back</span>
                Back to Timeline
              </button>
              <h2 style="font-size: 1.3rem; color: var(--primary); font-weight: 800; margin: 0;">
                {{ selectedConciergeDetailsProperty?.title }} Dashboard
              </h2>
            </div>
            
            <div style="display: flex; gap: 0.75rem;">
              <button 
                @click="startEditConcierge(selectedConciergeDetailsProperty)" 
                class="action-header-btn"
                style="background-color: var(--accent); color: var(--primary); font-weight: 700; padding: 0.5rem 1rem;"
              >
                <span class="material-icons-outlined" style="margin-right: 0.25rem;">edit</span>
                Edit Property Info
              </button>
            </div>
          </div>

          <!-- Tab Switcher Navigation -->
          <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.25rem; margin-top: 0.5rem; margin-bottom: 1rem;">
            <button 
              @click="propertyDetailsTab = 'calendar'" 
              style="padding: 0.6rem 1.25rem; font-weight: 700; border: none; background: none; cursor: pointer; font-size: 0.9rem; transition: all 0.2s; display: flex; align-items: center; gap: 0.35rem;" 
              :style="propertyDetailsTab === 'calendar' ? 'color: var(--primary); border-bottom: 3px solid var(--accent);' : 'color: #94a3b8;'"
            >
              <span class="material-icons-outlined" style="font-size: 1.1rem;">calendar_month</span>
              Property Calendar
            </button>
            <button 
              @click="propertyDetailsTab = 'bookings'" 
              style="padding: 0.6rem 1.25rem; font-weight: 700; border: none; background: none; cursor: pointer; font-size: 0.9rem; transition: all 0.2s; display: flex; align-items: center; gap: 0.35rem;" 
              :style="propertyDetailsTab === 'bookings' ? 'color: var(--primary); border-bottom: 3px solid var(--accent);' : 'color: #94a3b8;'"
            >
              <span class="material-icons-outlined" style="font-size: 1.1rem;">receipt_long</span>
              Bookings & Financials
            </button>
            <button 
              @click="propertyDetailsTab = 'reservation-form'" 
              style="padding: 0.6rem 1.25rem; font-weight: 700; border: none; background: none; cursor: pointer; font-size: 0.9rem; transition: all 0.2s; display: flex; align-items: center; gap: 0.35rem;" 
              :style="propertyDetailsTab === 'reservation-form' ? 'color: var(--primary); border-bottom: 3px solid var(--accent);' : 'color: #94a3b8;'"
            >
              <span class="material-icons-outlined" style="font-size: 1.1rem;">{{ bookingForm.id ? 'edit_calendar' : 'add_moderator' }}</span>
              {{ bookingForm.id ? 'Edit Reservation' : 'New Reservation' }}
            </button>
          </div>

          <!-- TAB CONTENT BLOCKS -->
          
          <!-- TAB 1: DEDICATED CALENDAR -->
          <div v-if="propertyDetailsTab === 'calendar'" class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <!-- Monthly Controls -->
            <div class="calendar-controls-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <button
                  @click="scrollToToday"
                  style="padding: 0.45rem 1rem; border: 1.5px solid var(--accent); background: var(--accent); color: var(--primary); border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 0.35rem; transition: opacity 0.15s;"
                  @mouseenter="$event.target.style.opacity='0.85'"
                  @mouseleave="$event.target.style.opacity='1'"
                >
                  <span class="material-icons-outlined" style="font-size: 1rem;">today</span>
                  Today
                </button>
                <div class="calendar-nav" style="display: flex; align-items: center; gap: 0.75rem;">
                  <button @click="prevMonth" class="action-btn" style="padding: 0.5rem; border: 1px solid #eee; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center;">
                    <span class="material-icons-outlined">chevron_left</span>
                  </button>
                  <select v-model="currentMonth" style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #eee; background: white; font-weight: 600; color: var(--primary); cursor: pointer; font-size: 0.9rem;">
                    <option v-for="(mName, idx) in monthNames" :key="idx" :value="idx">{{ mName }}</option>
                  </select>
                  <select v-model="currentYear" style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #eee; background: white; font-weight: 600; color: var(--primary); cursor: pointer; font-size: 0.9rem;">
                    <option v-for="y in [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032]" :key="y" :value="y">{{ y }}</option>
                  </select>
                  <button @click="nextMonth" class="action-btn" style="padding: 0.5rem; border: 1px solid #eee; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center;">
                    <span class="material-icons-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
              <div style="font-size: 0.82rem; color: #6b7280; font-weight: 600;">
                <span class="material-icons-outlined" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem; color: var(--accent);">info</span>
                Click a free day to add a reservation, or click a booking pill to edit/cancel.
              </div>
            </div>

            <!-- Monthly Grid Calendar (Traditional View) -->
            <div class="monthly-grid-calendar-container" style="background: white; border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);">
              
              <!-- Weekday Header Row -->
              <div class="grid-header" style="display: grid; grid-template-columns: repeat(7, 1fr); background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; text-align: center; font-weight: 700; font-size: 0.85rem; color: #475569; min-height: 40px; align-items: center;">
                <div style="padding: 0.5rem; border-right: 1px solid #e2e8f0;">Monday</div>
                <div style="padding: 0.5rem; border-right: 1px solid #e2e8f0;">Tuesday</div>
                <div style="padding: 0.5rem; border-right: 1px solid #e2e8f0;">Wednesday</div>
                <div style="padding: 0.5rem; border-right: 1px solid #e2e8f0;">Thursday</div>
                <div style="padding: 0.5rem; border-right: 1px solid #e2e8f0;">Friday</div>
                <div style="padding: 0.5rem; border-right: 1px solid #e2e8f0; color: #dc2626;">Saturday</div>
                <div style="padding: 0.5rem; color: #dc2626;">Sunday</div>
              </div>

              <!-- Weeks & Days Grid -->
              <div style="display: flex; flex-direction: column;">
                <div 
                  v-for="(week, wIdx) in propertyCalendarWeeks" 
                  :key="wIdx" 
                  style="display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid #e2e8f0;"
                  :style="wIdx === propertyCalendarWeeks.length - 1 ? 'border-bottom: none;' : ''"
                >
                  <div 
                    v-for="(day, dIdx) in week" 
                    :key="dIdx"
                    @click="handlePropertyDetailsCellClick(selectedConciergeDetailsProperty, day.date)"
                    style="min-height: 130px; padding: 0.5rem; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; cursor: pointer; transition: background 0.15s; position: relative;"
                    :style="[
                      dIdx === 6 ? 'border-right: none;' : '',
                      !day.isCurrentMonth ? 'background-color: #f8fafc; opacity: 0.55;' : 'background-color: white;',
                      isToday(day.date) ? 'background-color: #eff6ff;' : '',
                      isCellSelected(selectedConciergeDetailsProperty, day.date) ? 'background-color: rgba(245, 158, 11, 0.25) !important; outline: 1.5px solid var(--accent); z-index: 5;' : ''
                    ]"
                    @mouseenter="selectionState.startDate ? (selectionState.hoverDate = day.date) : ($event.currentTarget.style.backgroundColor = isToday(day.date) ? '#dbeafe' : '#f1f5f9')"
                    @mouseleave="selectionState.startDate ? null : ($event.currentTarget.style.backgroundColor = !day.isCurrentMonth ? '#f8fafc' : (isToday(day.date) ? '#eff6ff' : 'white'))"
                  >
                    <!-- Day Number & Indicators -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                      <span 
                        style="font-size: 0.9rem; font-weight: 700; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;"
                        :style="isToday(day.date) ? 'background-color: var(--accent); color: var(--primary); font-weight: 800; box-shadow: 0 1px 3px rgba(0,0,0,0.1);' : (day.date.getDay() === 0 || day.date.getDay() === 6 ? 'color: #dc2626;' : 'color: #475569;')"
                      >
                        {{ day.date.getDate() }}
                      </span>
                    </div>

                    <!-- Booking pills overlay inside the cell (night-based split style) -->
                    <div style="position: absolute; left: 0; right: 0; top: 40px; bottom: 8px; pointer-events: none;">
                      <div 
                        v-for="state in getBookingsForDay(selectedConciergeDetailsProperty, day.date)"
                        :key="state.booking.id"
                        class="booking-pill-bar"
                        :class="{
                          'booking-start': state.isStart,
                          'booking-end': state.isEnd
                        }"
                        :title="`${selectedConciergeDetailsProperty.title}: ${state.booking.summary}`"
                        @click.stop="selectBookingForEdit(state.booking)"
                        style="position: absolute; top: 0; bottom: 0; margin-top: auto; margin-bottom: auto; height: 38px; font-weight: 700; font-size: 0.72rem; display: flex; align-items: center; justify-content: flex-start; border-top: 1px solid rgba(255,255,255,0.25); border-bottom: 1px solid rgba(0,0,0,0.12); box-shadow: 0 2px 4px rgba(0,0,0,0.06); border-radius: 6px; z-index: 10; pointer-events: auto; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                        :style="getBookingBarStyle(state.booking, state.isStart, state.isEnd, getBookingsForDay(selectedConciergeDetailsProperty, day.date))"
                      >
                        <!-- Display guest name / summary inside the pill -->
                        <span 
                          v-if="state.isStart" 
                          style="padding: 0 8px; font-size: 0.7rem; font-weight: 800; white-space: nowrap; pointer-events: none;"
                        >
                          🔑 {{ state.booking.summary }}
                        </span>
                        <span 
                          v-else-if="!state.isEnd" 
                          style="padding: 0 8px; font-size: 0.7rem; font-weight: 800; white-space: nowrap; pointer-events: none;"
                        >
                          🛏️ {{ state.booking.summary }}
                        </span>
                        <span 
                          v-else 
                          style="padding: 0 8px; font-size: 0.7rem; font-weight: 800; white-space: nowrap; pointer-events: none;"
                        >
                          🚪 OUT
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 2: BOOKINGS LIST -->
          <div v-else-if="propertyDetailsTab === 'bookings'" class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 2px solid #f3f4f6; padding-bottom: 0.5rem; flex-wrap: wrap; gap: 1rem;">
              <h2 style="font-size: 1.2rem; color: var(--primary); font-weight: 700; margin: 0;">
                All Bookings & Financial Records
              </h2>
              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                <!-- Period select dropdown -->
                <div style="display: flex; align-items: center; gap: 0.35rem; border: 1px solid #e5e7eb; padding: 0.35rem 0.6rem; border-radius: 6px; background: #f9fafb;">
                  <span style="font-size: 0.75rem; font-weight: 700; color: #4b5563; white-space: nowrap;">Period:</span>
                  <select v-model="emailReportPeriod.type" style="padding: 0.2rem 0.4rem; border-radius: 4px; border: 1px solid #ddd; background: white; font-size: 0.78rem; font-weight: 600; cursor: pointer; color: #374151;">
                    <option value="selected">Current Month</option>
                    <option value="custom">Custom Month</option>
                    <option value="all">All Time</option>
                  </select>
                  
                  <template v-if="emailReportPeriod.type === 'custom'">
                    <select v-model="emailReportPeriod.month" style="padding: 0.2rem 0.4rem; border-radius: 4px; border: 1px solid #ddd; background: white; font-size: 0.78rem; font-weight: 600; cursor: pointer; color: #374151;">
                      <option v-for="(mName, idx) in monthNames" :key="idx" :value="idx">{{ mName }}</option>
                    </select>
                    <select v-model="emailReportPeriod.year" style="padding: 0.2rem 0.4rem; border-radius: 4px; border: 1px solid #ddd; background: white; font-size: 0.78rem; font-weight: 600; cursor: pointer; color: #374151;">
                      <option v-for="y in [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032]" :key="y" :value="y">{{ y }}</option>
                    </select>
                  </template>
                </div>

                <button
                  @click="sendOwnerReportEmail"
                  :disabled="isSendingEmail"
                  style="padding: 0.45rem 1rem; border: 1.5px solid #2563eb; border-radius: 6px; font-size: 0.8rem; background: #2563eb; color: white; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; font-weight: 700;"
                >
                  <span class="material-icons-outlined" style="font-size: 0.95rem;">mail</span>
                  {{ isSendingEmail ? 'Sending...' : 'Email to Owner' }}
                </button>
                <button
                  @click="exportReservationsToExcel(filteredConciergePropertyBookings, selectedConciergeDetailsProperty.title)"
                  style="padding: 0.45rem 1rem; border: 1.5px solid #107c41; border-radius: 6px; font-size: 0.8rem; background: #107c41; color: white; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; font-weight: 700;"
                >
                  <span class="material-icons-outlined" style="font-size: 0.95rem;">download_for_offline</span>
                  Export Excel
                </button>
              </div>
            </div>
            
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                  <tr style="border-bottom: 2px solid #f3f4f6; text-align: left; background-color: #f9fafb; color: #4b5563; font-weight: 700;">
                    <th style="padding: 10px;">Guest / Source</th>
                    <th style="padding: 10px;">Dates (Nights)</th>
                    <th style="padding: 10px;">Revenue Split</th>
                    <th style="padding: 10px; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="b in filteredConciergePropertyBookings" :key="b.id" style="border-bottom: 1px solid #f3f4f6; transition: background 0.2s; cursor: pointer;" @click="selectBookingForEdit(b)" class="hover-row">
                    <td style="padding: 10px;">
                      <strong style="color: var(--primary); font-size: 0.9rem;">{{ b.is_block ? 'Blocked Period' : (b.guest_name || b.summary) }}</strong>
                      <div v-if="b.notes" style="font-size: 0.76rem; color: #475569; margin-top: 0.15rem; font-style: italic; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" :title="b.notes">
                        Reason: {{ b.notes }}
                      </div>
                      <div style="margin-top: 0.2rem;">
                        <span class="status-pill" :style="{
                          backgroundColor: b.is_block ? '#e2e8f0' : (b.source === 'airbnb' ? '#fee2e2' : b.source === 'booking' ? '#dbeafe' : '#ffedd5'),
                          color: b.is_block ? '#475569' : (b.source === 'airbnb' ? '#991b1b' : b.source === 'booking' ? '#1e40af' : '#9a3412'),
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: '700'
                        }">
                          {{ b.is_block ? 'Blocked' : (b.source === 'airbnb' ? 'Airbnb' : b.source === 'booking' ? 'Booking.com' : 'Resaoff') }}
                        </span>
                      </div>
                    </td>
                    <td style="padding: 10px;">
                      <span style="font-weight: 600; color: #374151;">{{ formatDateToEU(b.start_date) }} - {{ formatDateToEU(b.end_date) }}</span>
                      <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.1rem;">
                        {{ b.nights || 1 }} {{ b.is_block ? 'days' : 'nights' }}
                      </div>
                    </td>
                    <td style="padding: 10px;">
                      <template v-if="b.is_block">
                        <span style="color: #64748b; font-size: 0.8rem; font-weight: 600;">Not available for rent</span>
                      </template>
                      <template v-else>
                        <div style="font-weight: 700; color: #16a34a;">Total: €{{ b.price || 0 }}</div>
                        <div style="font-size: 0.75rem; color: #4b5563; margin-top: 0.15rem; display: flex; flex-direction: column; gap: 0.1rem;">
                          <span>Owner: €{{ b.owner_payout || 0 }}</span>
                          <span>Doorman ({{ b.commission_rate || 20 }}%): €{{ b.doorman_commission || 0 }}</span>
                        </div>
                      </template>
                    </td>
                    <td style="padding: 10px; text-align: right;" @click.stop>
                      <button @click="deleteConciergeBookingInDetails(b.id)" class="delete-btn" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;">
                        <span class="material-icons-outlined" style="font-size: 0.85rem;">delete</span>
                        Cancel
                      </button>
                    </td>
                  </tr>
                  <tr v-if="filteredConciergePropertyBookings.length === 0">
                    <td colspan="4" style="text-align: center; padding: 2rem; color: #9ca3af; font-weight: 600;">No bookings found for this period.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- TAB 3: RESERVATION FORM -->
          <div v-else-if="propertyDetailsTab === 'reservation-form'" class="card" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); max-width: 600px; margin: 0 auto; width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 2px solid #f3f4f6; padding-bottom: 0.5rem;">
              <h2 style="font-size: 1.2rem; color: var(--primary); font-weight: 700; margin: 0;">
                {{ bookingForm.id ? 'Edit Reservation' : 'New Reservation' }}
              </h2>
              <button v-if="bookingForm.id" @click="resetBookingForm" class="edit-btn" style="padding: 2px 8px; font-size: 0.75rem;">
                Clear Form
              </button>
            </div>

            <form @submit.prevent="saveAdvancedBooking" style="display: flex; flex-direction: column; gap: 1.25rem;">
              <!-- Block Calendar Checkbox -->
              <div style="background-color: #f3f4f6; padding: 0.6rem 1rem; border-radius: 8px;">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.85rem; color: var(--primary); cursor: pointer; margin: 0;">
                  <input type="checkbox" v-model="bookingForm.is_block" style="width: 16px; height: 16px; cursor: pointer;" />
                  Block Calendar (Owner / Maintenance)
                </label>
              </div>

              <!-- Platform Select -->
              <div v-if="!bookingForm.is_block" class="filter-group">
                <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase;">Platform / Source</label>
                <select v-model="bookingForm.platform" :required="!bookingForm.is_block" style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; background: white; width: 100%;">
                  <option value="airbnb">Airbnb</option>
                  <option value="booking">Booking.com</option>
                  <option value="resaoff">Resaoff (Offline Direct)</option>
                </select>
              </div>

              <!-- Guest Name -->
              <div v-if="!bookingForm.is_block" class="filter-group">
                <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase;">Guest Name (First & Last)</label>
                <input v-model="bookingForm.guest_name" type="text" :required="!bookingForm.is_block" placeholder="e.g. John Doe" style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
              </div>

              <!-- Date grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="filter-group">
                  <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase;">{{ bookingForm.is_block ? 'Block Start Date' : 'Check-in Date' }}</label>
                  <input v-model="bookingForm.start_date" type="date" required style="padding: 0.6rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                </div>
                <div class="filter-group">
                  <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase;">{{ bookingForm.is_block ? 'Block End Date' : 'Check-out Date' }}</label>
                  <input v-model="bookingForm.end_date" type="date" required style="padding: 0.6rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                </div>
              </div>

              <!-- Nights (Auto-calculated) -->
              <div class="filter-group">
                <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase;">{{ bookingForm.is_block ? 'Blocked Days (Auto-calculated)' : 'Nights Stayed (Auto-calculated)' }}</label>
                <input :value="nightsCount" type="text" disabled style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; background-color: #f3f4f6; color: #4b5563; font-weight: 600; width: 100%;" />
              </div>

              <!-- Financial Inputs Grid -->
              <div v-if="!bookingForm.is_block" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="filter-group">
                  <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase;">Total Gross Price (€)</label>
                  <input v-model.number="bookingForm.price" type="number" step="0.01" :required="!bookingForm.is_block" style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                </div>
                <div class="filter-group">
                  <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase;">Platform Service Fee (€)</label>
                  <input v-model.number="bookingForm.platform_fee" type="number" step="0.01" style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
                </div>
              </div>

              <!-- Commission Rate -->
              <div v-if="!bookingForm.is_block" class="filter-group">
                <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase;">Doorman Commission Rate (%)</label>
                <input v-model.number="bookingForm.commission_rate" type="number" step="0.1" :required="!bookingForm.is_block" style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
              </div>

              <!-- Notes (Max 100 characters) -->
              <div class="filter-group">
                <label style="font-weight: 700; font-size: 0.75rem; color: #4b5563; text-transform: uppercase;">{{ bookingForm.is_block ? 'Block Reason / Notes' : 'Notes (Max 100 chars)' }}</label>
                <input v-model="bookingForm.notes" type="text" maxlength="100" placeholder="e.g. Owner stay, renovation, pipe repair..." style="padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
              </div>

              <!-- Live calculations / Split Breakdown panel -->
              <div v-if="!bookingForm.is_block" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem;">
                <h3 style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25rem;">
                  Dynamic Payout Split
                </h3>

                <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                  <span style="color: #475569;">Nightly Rate (Avg):</span>
                  <strong style="color: #0f172a;">€{{ payoutBreakdown.nightly }} / night</strong>
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                  <span style="color: #475569;">Net Income (Gross - Fee):</span>
                  <strong style="color: #0f172a;">€{{ payoutBreakdown.net }}</strong>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                  <span style="color: #475569;">Owner Share:</span>
                  <strong style="color: #475569;">€{{ payoutBreakdown.owner }}</strong>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; border-top: 1px dashed #cbd5e1; padding-top: 0.5rem;">
                  <span style="color: #0f172a; font-weight: 700;">Doorman Payout ({{ bookingForm.commission_rate }}%):</span>
                  <strong style="color: #0f172a; font-weight: 800; font-size: 1rem;">€{{ payoutBreakdown.doorman }}</strong>
                </div>
              </div>

              <!-- Submit Action -->
              <button type="submit" class="submit-btn" style="width: 100%; padding: 0.8rem; justify-content: center; font-weight: 700; margin-top: 0.5rem;">
                <span class="material-icons-outlined" style="margin-right: 0.5rem;">save</span>
                {{ bookingForm.id ? 'Update Reservation' : 'Save Reservation' }}
              </button>
            </form>
          </div>

        </div>
      </div>
      </div>
    </main>
  </div>

  <!-- 1. Property Details Modal -->
  <transition name="fade">
    <div v-if="showConciergeDetailsModal && selectedConciergeDetailsProperty" class="modal-overlay" @click.self="showConciergeDetailsModal = false">
      <div class="filter-modal" style="max-width: 600px;">
        <div class="modal-header">
          <h3>{{ selectedConciergeDetailsProperty.title }} Details</h3>
          <button @click="showConciergeDetailsModal = false" class="close-btn">&times;</button>
        </div>
        <div class="filter-modal-body" style="padding: 1.5rem;">
          <div style="margin-bottom: 1.5rem;">
            <p><strong>Address:</strong> {{ selectedConciergeDetailsProperty.address || 'No Address' }}</p>

          </div>

          <!-- List Bookings -->
          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: var(--primary); margin-bottom: 0.75rem; border-bottom: 1px solid #eee; padding-bottom: 0.25rem;">Active Bookings</h4>
            
            <!-- Date Filter for Bookings -->
            <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; background: #f8fafc; padding: 0.6rem; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="display: flex; align-items: center; gap: 0.35rem; flex: 1;">
                <label style="font-size: 0.72rem; font-weight: 700; color: #475569; text-transform: uppercase;">Year:</label>
                <select v-model.number="propertyDetailsFilterYear" style="padding: 0.35rem 0.5rem; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.8rem; flex: 1; background: white; outline: none; cursor: pointer;">
                  <option v-for="y in Array.from({length: 10}, (_, i) => 2024 + i)" :key="y" :value="y">{{ y }}</option>
                </select>
              </div>
              <div style="display: flex; align-items: center; gap: 0.35rem; flex: 1.5;">
                <label style="font-size: 0.72rem; font-weight: 700; color: #475569; text-transform: uppercase;">Month:</label>
                <select v-model.number="propertyDetailsFilterMonth" style="padding: 0.35rem 0.5rem; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.8rem; flex: 1; background: white; outline: none; cursor: pointer;">
                  <option :value="1">January</option>
                  <option :value="2">February</option>
                  <option :value="3">March</option>
                  <option :value="4">April</option>
                  <option :value="5">May</option>
                  <option :value="6">June</option>
                  <option :value="7">July</option>
                  <option :value="8">August</option>
                  <option :value="9">September</option>
                  <option :value="10">October</option>
                  <option :value="11">November</option>
                  <option :value="12">December</option>
                </select>
              </div>
            </div>

            <div style="max-height: 250px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                  <tr style="border-bottom: 2px solid #eee; text-align: left; background-color: #f9fafb;">
                    <th style="padding: 6px;">Guest / Source</th>
                    <th style="padding: 6px;">Dates</th>
                    <th style="padding: 6px;">Price</th>
                    <th style="padding: 6px; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="b in filteredPropertyDetailsBookings" :key="b.id" style="border-bottom: 1px solid #eee;">
                    <td style="padding: 6px;">
                      <strong>{{ b.guest_name || b.summary }}</strong>
                      <div v-if="b.notes" style="font-size: 0.74rem; color: #475569; font-style: italic; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.1rem;" :title="b.notes">
                        Note: {{ b.notes }}
                      </div>
                      <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.15rem;">
                        {{ b.is_manual ? 'Direct Reservation' : 'Synced from iCal' }}
                      </div>
                    </td>
                    <td style="padding: 6px;">
                      {{ formatDateToEU(b.start_date) }} - {{ formatDateToEU(b.end_date) }}
                    </td>
                    <td style="padding: 6px;">
                      {{ b.price ? '€' + b.price : 'N/A' }}
                    </td>
                    <td style="padding: 6px; text-align: right;">
                      <button v-if="b.is_manual" @click="deleteManualBooking(b.id)" class="delete-btn" style="padding: 2px 6px; font-size: 0.75rem;">
                        Cancel
                      </button>
                      <span v-else style="font-size: 0.75rem; color: #9ca3af;">iCal</span>
                    </td>
                  </tr>
                  <tr v-if="filteredPropertyDetailsBookings.length === 0">
                    <td colspan="4" style="text-align: center; padding: 12px; color: #9ca3af;">No bookings found for this period.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Quick Add Reservation Button -->
          <button @click="openBookingModal(selectedConciergeDetailsProperty)" class="action-header-btn" style="width: 100%; justify-content: center; padding: 0.75rem;">
            <span class="material-icons-outlined">add</span>
            Add Direct Reservation
          </button>
        </div>
        <div class="modal-footer">
          <button @click="showConciergeDetailsModal = false" class="reset-btn" style="width: 100%;">Close</button>
        </div>
      </div>
    </div>
  </transition>

  <!-- 2. Booking Creation Modal -->
  <transition name="fade">
    <div v-if="showBookingModal && selectedBookingProperty" class="modal-overlay" @click.self="showBookingModal = false">
      <div class="filter-modal" style="max-width: 450px;">
        <div class="modal-header">
          <h3>Add Reservation</h3>
          <button @click="showBookingModal = false" class="close-btn">&times;</button>
        </div>
        <form @submit.prevent="addManualBooking">
          <div class="filter-modal-body">
            <div class="filter-group">
              <label>Property</label>
              <input type="text" :value="selectedBookingProperty.title" disabled style="padding: 0.6rem 1rem; border: 1px solid #eee; border-radius: 8px; font-size: 0.9rem; background-color: #f3f4f6; color: #4b5563;" />
            </div>
            <div class="filter-group">
              <label>Guest Name</label>
              <input v-model="newBooking.guest_name" type="text" required placeholder="e.g. John Doe" style="padding: 0.6rem 1rem; border: 1px solid #eee; border-radius: 8px; font-size: 0.9rem;" />
            </div>
            <div class="filter-group">
              <label>Price (€)</label>
              <input v-model.number="newBooking.price" type="number" step="0.01" placeholder="e.g. 150.00" style="padding: 0.6rem 1rem; border: 1px solid #eee; border-radius: 8px; font-size: 0.9rem;" />
            </div>
            <div class="range-inputs">
              <div class="filter-group">
                <label>Check-in Date</label>
                <input v-model="newBooking.start_date" type="date" required style="padding: 0.6rem; border: 1px solid #eee; border-radius: 8px; font-size: 0.9rem;" />
              </div>
              <div class="filter-group">
                <label>Check-out Date</label>
                <input v-model="newBooking.end_date" type="date" required style="padding: 0.6rem; border: 1px solid #eee; border-radius: 8px; font-size: 0.9rem;" />
              </div>
            </div>
            <div class="filter-group" style="margin-top: 1rem;">
              <label>Notes (Max 100 chars)</label>
              <input v-model="newBooking.notes" type="text" maxlength="100" placeholder="e.g. Special request, late check-in..." style="padding: 0.6rem 1rem; border: 1px solid #eee; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" @click="showBookingModal = false" class="reset-btn">Cancel</button>
            <button type="submit" class="apply-btn">Save Reservation</button>
          </div>
        </form>
      </div>
    </div>
  </transition>

  <!-- 3. Booking Details Modal -->
  <transition name="fade">
    <div v-if="showBookingDetailsModal && selectedBookingDetail" class="modal-overlay" @click.self="showBookingDetailsModal = false">
      <div class="filter-modal" style="max-width: 450px;">
        <div class="modal-header">
          <h3>Reservation Details</h3>
          <button @click="showBookingDetailsModal = false" class="close-btn">&times;</button>
        </div>
        <form @submit.prevent="updateBookingDetails">
          <div class="filter-modal-body" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
            <div>
              <small style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #9ca3af; display: block; margin-bottom: 0.25rem;">Property</small>
              <strong style="color: var(--primary); font-size: 1rem;">{{ selectedBookingProperty ? selectedBookingProperty.title : 'N/A' }}</strong>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; border-top: 1px solid #f3f4f6; border-bottom: 1px solid #f3f4f6; padding: 0.75rem 0;">
              <div>
                <small style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #9ca3af; display: block; margin-bottom: 0.15rem;">Check-in</small>
                <span style="font-weight: 600; color: #374151; font-size: 0.9rem;">{{ formatDateToEU(selectedBookingDetail.start_date) }}</span>
              </div>
              <div>
                <small style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #9ca3af; display: block; margin-bottom: 0.15rem;">Check-out</small>
                <span style="font-weight: 600; color: #374151; font-size: 0.9rem;">{{ formatDateToEU(selectedBookingDetail.end_date) }}</span>
              </div>
            </div>
            
            <div class="filter-group">
              <label>Guest Name / Reservation Info</label>
              <input v-model="selectedBookingDetail.guest_name" type="text" placeholder="e.g. Mehmet Gümüş" style="padding: 0.6rem 1rem; border: 1px solid #eee; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
              <span v-if="!selectedBookingDetail.is_manual && !selectedBookingDetail.guest_name" style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; display: block;">
                Original iCal Summary: {{ selectedBookingDetail.summary }}
              </span>
            </div>

            <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 1rem; align-items: start;">
              <div class="filter-group">
                <label>Price (€)</label>
                <input v-model.number="selectedBookingDetail.price" type="number" step="0.01" placeholder="e.g. 120.00" style="padding: 0.6rem 1rem; border: 1px solid #eee; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
              </div>
              <div>
                <small style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #9ca3af; display: block; margin-bottom: 0.5rem;">Source</small>
                <span v-if="selectedBookingDetail.is_manual" class="status-pill active" style="background-color: #dcfce7; color: #166534; font-size: 0.75rem; font-weight: 700;">
                  Direct Booking
                </span>
                <span v-else class="status-pill active" style="background-color: #dbeafe; color: #1e40af; font-size: 0.75rem; font-weight: 700;">
                  Airbnb iCal
                </span>
              </div>
            </div>
            
            <div class="filter-group" style="margin-top: 0.5rem;">
              <label>Notes (Max 100 chars)</label>
              <input v-model="selectedBookingDetail.notes" type="text" maxlength="100" placeholder="e.g. Special request, key details..." style="padding: 0.6rem 1rem; border: 1px solid #eee; border-radius: 8px; font-size: 0.9rem; width: 100%;" />
            </div>
            
            <div v-if="selectedBookingDetail.is_manual" style="margin-top: 0.5rem; border-top: 1px solid #f3f4f6; padding-top: 1rem;">
              <button type="button" @click="deleteManualBooking(selectedBookingDetail.id)" class="delete-btn" style="width: 100%; padding: 0.7rem; justify-content: center; display: flex; align-items: center; gap: 0.5rem;">
                <span class="material-icons-outlined">delete</span>
                Cancel Reservation
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" @click="showBookingDetailsModal = false" class="reset-btn">Close</button>
            <button type="submit" class="apply-btn">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  </transition>

  <!-- Calendar Selection Action Modal -->
  <transition name="fade">
    <div v-if="showCalendarSelectionModal" class="modal-overlay" @click.self="cancelCalendarSelection">
      <div class="filter-modal" style="max-width: 400px; padding: 1.5rem; text-align: center; border-radius: 16px; background: white;">
        <h3 style="margin-bottom: 0.5rem; color: var(--primary); font-weight: 700; font-size: 1.2rem;">Select Action</h3>
        <p style="font-size: 0.9rem; color: #4b5563; margin-bottom: 1.5rem; line-height: 1.4;">
          Property: <strong>{{ selectedPropertyTitle }}</strong><br />
          Selected Dates: <strong style="color: var(--primary);">{{ formattedSelectionDates }}</strong>
        </p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button @click="handleCalendarAction('block')" class="submit-btn" style="width: 100%; justify-content: center; background-color: #64748b; border-color: #64748b; font-weight: 700; padding: 0.75rem; border-radius: 8px;">
            <span class="material-icons-outlined" style="margin-right: 0.5rem;">lock</span>
            Block Calendar
          </button>
          <button @click="handleCalendarAction('unblock')" class="submit-btn" style="width: 100%; justify-content: center; background-color: #059669; border-color: #059669; font-weight: 700; padding: 0.75rem; border-radius: 8px;">
            <span class="material-icons-outlined" style="margin-right: 0.5rem;">lock_open</span>
            Open / Unblock
          </button>
          <button @click="handleCalendarAction('book')" class="submit-btn" style="width: 100%; justify-content: center; font-weight: 700; padding: 0.75rem; border-radius: 8px;">
            <span class="material-icons-outlined" style="margin-right: 0.5rem;">add_circle_outline</span>
            Add Reservation
          </button>
          <button @click="cancelCalendarSelection" class="cancel-btn" style="width: 100%; justify-content: center; border: 1px solid #d1d5db; padding: 0.75rem; border-radius: 8px; background: white; font-weight: 600; cursor: pointer;">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </transition>

</template>

<style scoped>
.admin-view {
  display: flex;
  background-color: var(--primary);
  min-height: 100vh;
}

/* Sidebar Styling */
.admin-sidebar {
  width: 70px;
  height: 100vh;
  background-color: var(--primary);
  color: white;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 4px 0 10px rgba(0, 0, 0, 0.05);
}

.admin-sidebar:hover {
  width: 280px;
}

/* Sidebar Branding (Logo and title) */
.sidebar-branding {
  display: flex;
  align-items: center;
  padding: 1rem 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  height: 80px;
  overflow: hidden;
}

.logo-wrapper {
  width: 45px;
  min-width: 45px;
  height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 8px;
  padding: 4px;
}

.sidebar-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.sidebar-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--accent);
  margin-left: 1rem;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.admin-sidebar:hover .sidebar-title {
  opacity: 1;
}

/* Navigation tabs */
.sidebar-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.5rem 0.65rem;
  flex: 1;
}

.sidebar-tab-btn {
  background: none;
  border: none;
  display: flex;
  align-items: center;
  padding: 0.85rem 0.85rem;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: all 0.2s ease;
  position: relative;
  text-decoration: none;
}

.sidebar-tab-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: white;
}

.sidebar-tab-btn.active {
  background-color: var(--accent);
  color: var(--primary);
  font-weight: 700;
}

.sidebar-tab-btn .material-icons-outlined {
  font-size: 1.5rem;
  min-width: 1.5rem;
  margin-right: 1.25rem;
}

.tab-label {
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
  font-weight: 600;
  font-size: 0.9rem;
}

.admin-sidebar:hover .tab-label {
  opacity: 1;
}

/* Badges */
.icon-badge-wrapper {
  position: relative;
  display: inline-flex;
}

.unread-badge-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  background-color: #ef4444;
  border-radius: 50%;
  border: 1.5px solid var(--primary);
}

.sidebar-tab-btn.active .unread-badge-dot {
  border-color: var(--accent);
}

.unread-badge-text {
  background-color: #ef4444;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 99px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.admin-sidebar:hover .unread-badge-text {
  opacity: 1;
}

/* Sidebar Footer (User details and logout) */
.sidebar-footer {
  padding: 1rem 0.65rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: rgba(0, 0, 0, 0.15);
}

.user-info {
  display: flex;
  align-items: center;
  padding: 0.25rem;
  overflow: hidden;
}

.user-avatar {
  font-size: 2.25rem !important;
  color: rgba(255, 255, 255, 0.8);
  margin-right: 0.75rem;
  min-width: 2.25rem;
}

.user-meta {
  display: flex;
  flex-direction: column;
  opacity: 0;
  transition: opacity 0.2s ease;
  overflow: hidden;
}

.admin-sidebar:hover .user-meta {
  opacity: 1;
}

.user-email {
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 170px;
}

.role-badge {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: 99px;
  letter-spacing: 0.05em;
  width: fit-content;
  margin-top: 0.25rem;
}

.role-badge.superuser {
  background: #dcfce7;
  color: #166534;
}
.role-badge.editor {
  background: #fef9c3;
  color: #854d0e;
}

.sidebar-logout-btn {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  display: flex;
  align-items: center;
  padding: 0.75rem 0.85rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.sidebar-logout-btn:hover {
  background-color: rgba(239, 68, 68, 0.3);
  color: white;
}

.sidebar-logout-btn .material-icons-outlined {
  font-size: 1.25rem;
  min-width: 1.25rem;
  margin-right: 1.5rem;
}

/* Main Content Area */
.admin-main-content {
  flex: 1;
  margin-left: 70px;
  background-color: var(--background-light);
  border-top-left-radius: 20px;
  border-bottom-left-radius: 20px;
  min-height: 100vh;
  min-width: 0;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: -5px 0 15px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.admin-content-wrap {
  max-width: 1200px;
  margin: 0 auto;
  padding: 3rem 2rem;
}

.quill-wrapper {
  background: white;
  margin-top: 0.5rem;
}

:deep(.ql-editor) {
  min-height: 300px;
  font-size: 1rem;
  line-height: 1.6;
}

:deep(.ql-toolbar) {
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

:deep(.ql-container) {
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
}

.card {
  background: white;
  padding: 2rem;
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  margin-bottom: 2rem;
}

.section-subtitle {
  font-family: var(--font-display);
  color: var(--primary);
  margin-bottom: 1.5rem;
  font-size: 1.25rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-field label {
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 700;
  color: #6b7280;
}

.form-field input,
.form-field select,
.form-field textarea {
  padding: 0.8rem;
  border: 1px solid var(--border-light);
  border-radius: 2px;
}

.submit-btn {
  background: var(--primary);
  color: var(--accent);
  padding: 0.8rem 1.5rem;
  border: none;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pagination-btn:hover:not(:disabled) {
  border-color: var(--primary) !important;
  color: var(--primary);
  background-color: #f9fafb !important;
}

.full-width {
  grid-column: 1 / -1;
}

.checkboxes {
  grid-column: 1 / -1;
  display: flex !important;
  flex-direction: row !important;
  gap: 2rem !important;
  margin-top: 1rem;
}

.transport-selector {
  position: relative;
  width: 100%;
}

.selected-transports {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #f9fafb;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  min-height: 50px;
}

.transport-tag {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--primary);
  color: white;
  padding: 0.3rem 0.6rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.remove-tag {
  font-size: 1rem !important;
  cursor: pointer;
  opacity: 0.8;
}

.remove-tag:hover {
  opacity: 1;
}

.add-transport-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: white;
  border: 1px dashed var(--primary);
  color: var(--primary);
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.add-transport-btn:hover {
  background: var(--primary);
  color: white;
}

.transport-dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
}

.transport-dropdown {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  width: 100%;
  max-width: 450px;
  background: white;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 100;
  padding: 1rem;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f3f4f6;
  font-weight: 700;
  color: var(--primary);
}

.close-dropdown {
  cursor: pointer;
  font-size: 1.2rem !important;
}

.dropdown-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  max-height: 250px;
  overflow-y: auto;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  font-size: 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.dropdown-item:hover {
  background: #f3f4f6;
}

.dropdown-item.selected {
  background: #e0f2fe;
  color: #0369a1;
}

.dropdown-item .icon {
  font-size: 1rem !important;
}

.property-list table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 0.45rem;
}

.property-list th {
  text-align: left;
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #6b7280;
  padding: 0.85rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  letter-spacing: 0.03em;
}

.property-list td {
  padding: 1rem;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  font-size: 0.9rem;
  transition:
    background-color 0.22s ease,
    color 0.22s ease;
}

.property-list tbody tr:nth-child(odd) td {
  background: #ffffff;
}

.property-list tbody tr:nth-child(even) td {
  background: #f8fafc;
}

.property-list tbody tr:hover td {
  background: #eef6f8;
}

.property-list tbody tr td:first-child {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
}

.property-list tbody tr td:last-child {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

.delete-btn {
  background: #fee2e2;
  color: #ef4444;
  border: none;
  padding: 0.4rem 0.8rem;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 4px;
}

.edit-btn {
  background: #dcfce7;
  color: #166534;
  border: none;
  padding: 0.4rem 0.8rem;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 4px;
}

.cleaning-report-table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.cleaning-report-table {
  min-width: 1120px;
}

.cleaning-report-actions-head,
.cleaning-report-actions-cell {
  width: 72px;
  min-width: 72px;
}

.cleaning-report-actions-cell {
  padding: 0.6rem 1rem 0.6rem 0.5rem;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
}

.cleaning-report-edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  font-size: 0.75rem;
  line-height: 1;
  border-radius: 6px;
  white-space: nowrap;
}

.cleaning-report-edit-btn .material-icons-outlined {
  font-size: 0.95rem;
  line-height: 1;
}

.cancel-btn {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 0.8rem 1.5rem;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
}

.edit-mode {
  border: 2px solid var(--accent) !important;
  background: #fffcf0;
}

.no-perms {
  font-size: 0.7rem;
  color: #9ca3af;
  font-style: italic;
}

.current-user-tag {
  font-size: 0.7rem;
  color: #9ca3af;
  font-weight: 700;
}

.audit-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.audit-user {
  font-weight: 600;
  color: #374151;
}

.audit-date {
  font-size: 0.7rem;
  color: #6b7280;
}

.status-pill {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.status-pill.active {
  background: #dcfce7;
  color: #166534;
}

.status-pill.sold {
  background: #fee2e2;
  color: #ef4444;
}

.status-pill.rented {
  background: #e0f2fe;
  color: #0369a1;
}

/* Media Section Styles */
.media-section {
  margin-top: 1rem;
}

.upload-trigger {
  margin-bottom: 1.5rem;
}

.file-input {
  display: none;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--primary);
  color: var(--accent);
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.8rem;
  transition: opacity 0.2s;
}

.upload-btn:hover {
  opacity: 0.9;
}

.media-previews {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1.5rem;
}

.preview-item {
  position: relative;
  background: #f9fafb;
  padding: 0.5rem;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  cursor: grab;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
  user-select: none;
}

.preview-item:active {
  cursor: grabbing;
}

.preview-item.dragging {
  cursor: grabbing;
  opacity: 0.5;
  transform: scale(0.95);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  border: 2px dashed var(--accent);
}

.preview-item img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 2px;
  margin-bottom: 0.5rem;
}

.remove-media {
  position: absolute;
  top: -10px;
  right: -10px;
  background: #ef4444;
  color: white;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.remove-media .material-icons-outlined {
  font-size: 16px;
}

.thumbnail-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
}

/* Description Tabs */
.description-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.lang-tabs {
  display: flex;
  gap: 0.5rem;
}

.lang-tab {
  background: #f3f4f6;
  border: 1px solid var(--border-light);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-tab:hover {
  background: #e5e7eb;
}

.lang-tab.active {
  background: var(--primary);
  color: var(--accent);
  border-color: var(--primary);
}
/* Filter Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.filter-modal {
  background: white;
  width: 90%;
  max-width: 500px;
  max-height: 85vh;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
}

.filter-modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #6b7280;
}

.range-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.range-inputs input {
  padding: 0.6rem 1rem;
  border: 1px solid #eee;
  border-radius: 8px;
  font-size: 0.9rem;
}

.multi-select-box {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-height: 120px;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid #eee;
  border-radius: 8px;
  background: #f9fafb;
}

.multi-select-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 4px 10px;
  background: white;
  border: 1px solid #eee;
  border-radius: 20px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.multi-select-item:hover {
  background: #f3f4f6;
}

.modal-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.reset-btn {
  padding: 0.75rem 1.25rem;
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  color: #666;
  font-weight: 700;
  cursor: pointer;
}

.apply-btn {
  flex: 1;
  padding: 0.75rem 1.25rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Tab headers & Actions styling */
.tab-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-light);
}

.tab-title {
  color: var(--primary);
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
}

.action-header-btn {
  background-color: var(--accent);
  color: var(--primary);
  border: none;
  padding: 0.65rem 1.25rem;
  font-size: 0.85rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.action-header-btn:hover {
  background-color: var(--primary);
  color: var(--accent);
  transform: translateY(-1px);
}

.action-header-btn.secondary-btn {
  background-color: #f3f4f6;
  color: #4b5b60;
  border: 1px solid #e5e7eb;
}

.action-header-btn.secondary-btn:hover {
  background-color: #e5e7eb;
  color: var(--primary);
}

/* Concierge Calendar Styling */
.timeline-container::-webkit-scrollbar {
  height: 8px;
}

.timeline-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.timeline-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.timeline-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.timeline-cell.day-col.is-weekend {
  background-color: #f9fafb !important;
}

.property-row:hover {
  background-color: #f9fafb;
}

.property-row:hover .property-col {
  background-color: #f9fafb !important;
}

.booking-pill-bar {
  transition: all 0.2s ease;
}

.booking-pill-bar:hover {
  filter: brightness(0.9);
  transform: scaleY(1.05);
}

/* Navigation Hover Dropdown Styles */
.nav-dropdown-wrapper {
  position: relative;
  display: inline-block;
  z-index: 100;
}

.nav-dropdown-wrapper:hover .nav-dropdown-menu {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.nav-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.5rem;
  min-width: 210px;
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  opacity: 0;
  visibility: hidden;
  transform: translateY(10px);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  z-index: 999;
}

.nav-dropdown-menu a {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  color: #4b5563;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.nav-dropdown-menu a:hover {
  background-color: #f3f4f6;
  color: var(--primary);
}

.nav-dropdown-menu a.active {
  background-color: #eff6ff;
  color: #2563eb;
}

.nav-dropdown-menu a .material-icons-outlined {
  font-size: 1.15rem;
}
</style>
