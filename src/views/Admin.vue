<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { QuillEditor } from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";
import * as XLSX from "xlsx";

const { t } = useI18n();
const router = useRouter();
const properties = ref([]);
const blogPosts = ref([]);
const users = ref([]);
const contactMessages = ref([]);
const researchListings = ref([]);
const buyers = ref([]);
const isEditingResearch = ref(false);

const editingResearchId = ref(null);
const unreadMessagesCount = computed(
  () => contactMessages.value.filter((m) => !m.is_read).length,
);

const filteredResearchListings = computed(() => {
  let result = [...researchListings.value].filter((item) => {
    // Search Filter
    const matchesSearch =
      !researchSearchQuery.value ||
      item.neighborhood
        ?.toLowerCase()
        .includes(researchSearchQuery.value.toLowerCase()) ||
      item.address
        ?.toLowerCase()
        .includes(researchSearchQuery.value.toLowerCase()) ||
      item.zip_code?.includes(researchSearchQuery.value);

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


const researchSortKey = ref("created_at"); // price, price_per_sqm, rooms, square_meters, created_at
const researchSortOrder = ref("desc"); // asc, desc
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

const userRole = computed(() => localStorage.getItem("admin_role") || "editor");
const isSuperuser = computed(() => userRole.value === "superuser");
const userEmail = computed(() => localStorage.getItem("admin_email"));

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
  // Scroll to form
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const cancelEdit = () => {
  isEditing.value = false;
  editingId.value = null;
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

const startEditBlog = (post) => {
  isEditingBlog.value = true;
  editingBlogId.value = post.id;
  newBlogPost.value = JSON.parse(JSON.stringify(post));
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const cancelEditBlog = () => {
  isEditingBlog.value = false;
  editingBlogId.value = null;
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

const addResearchListing = async () => {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`${backendUrl}/admin/research-listings/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newResearch.value),
    });

    if (res.ok) {
      await fetchResearchListings();
      alert("Research listing added!");
      resetResearchForm();
    } else {
      const errData = await res.json();
      alert(`Error: ${errData.detail}`);
    }
  } catch (err) {
    alert("Network error.");
  }
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

    tag_ids: listing.tags ? listing.tags.map((t) => t.id) : [],
  };

  // Scroll to form
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const cancelEditResearch = () => {
  resetResearchForm();
};

const updateResearchListing = async () => {
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
          ...newResearch.value,
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

onMounted(async () => {
  fetchProperties();
  fetchBlogPosts();
  fetchContactMessages();
  fetchResearchListings();
  fetchBuyers();
  fetchResearchTags();

  if (isSuperuser.value) {
    fetchUsers();
    fetchPasswordResets();
  }
});
</script>

<template>
  <div class="admin-view">
    <div class="admin-container">
      <div class="admin-header">
        <div class="header-branding">
          <img
            src="/doormanlogo.webp"
            alt="Doorman Admin"
            class="admin-logo-img"
          />
          <h1 class="admin-title">Admin Panel</h1>
        </div>
        <div class="header-actions">
          <span class="role-badge" :class="userRole">{{ userRole }}</span>
          <button @click="handleLogout" class="logout-btn">Logout</button>
        </div>
      </div>

      <!-- TABS -->
      <div class="admin-tabs">
        <button
          @click="activeTab = 'properties'"
          :class="{ active: activeTab === 'properties' }"
        >
          Properties
        </button>
        <button
          @click="activeTab = 'blogs'"
          :class="{ active: activeTab === 'blogs' }"
        >
          Blog Posts
        </button>
        <button
          @click="activeTab = 'research'"
          :class="{ active: activeTab === 'research' }"
        >
          Research
        </button>

        <button
          v-if="isSuperuser"
          @click="activeTab = 'users'"
          :class="{ active: activeTab === 'users' }"
        >
          User Management
        </button>
        <button
          @click="activeTab = 'messages'"
          :class="{ active: activeTab === 'messages' }"
          style="position: relative"
        >
          Contact Messages
          <span v-if="unreadMessagesCount > 0" class="unread-badge">{{
            unreadMessagesCount
          }}</span>
        </button>
        <button
          @click="activeTab = 'profile'"
          :class="{ active: activeTab === 'profile' }"
        >
          Profile
        </button>
      </div>

      <!-- PROPERTIES MANAGEMENT -->
      <div v-if="activeTab === 'properties'" class="tab-content">
        <!-- Add/Edit Form -->
        <section class="admin-section card" :class="{ 'edit-mode': isEditing }">
          <h2 class="section-subtitle">
            {{ isEditing ? "Edit Property" : "Add New Property" }}
          </h2>
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
                  placeholder="Türkçe açıklama..."
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
                  >
                    <img :src="m.url" alt="Preview" />
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
        <section class="admin-section card">
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
        <!-- Add/Edit Blog Form -->
        <section
          class="admin-section card"
          :class="{ 'edit-mode': isEditingBlog }"
        >
          <h2 class="section-subtitle">
            {{ isEditingBlog ? "Edit Blog Post" : "Add New Blog Post" }}
          </h2>
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
        <section class="admin-section card">
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
          <h2 class="section-subtitle">Buyer Management (Alıcılar)</h2>
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
        <section
          class="admin-section card"
          :class="{ 'edit-mode': isEditingResearch }"
        >
          <h2 class="section-subtitle">
            {{
              isEditingResearch
                ? "Edit Research Property"
                : "Add Research Property"
            }}
          </h2>
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
              <div class="form-field">
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

              <div class="form-field">
                <label>Neighborhood (Mahalle)</label>
                <input
                  v-model="newResearch.neighborhood"
                  type="text"
                  required
                  placeholder="Paris 5"
                />
              </div>
              <div class="form-field">
                <label>Zip Code (Posta Kodu)</label>
                <input
                  v-model="newResearch.zip_code"
                  type="text"
                  required
                  placeholder="75005"
                />
              </div>
              <div class="form-field">
                <label>Address</label>
                <input v-model="newResearch.address" type="text" />
              </div>

              <div class="form-field">
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

              <div class="form-field">
                <label>Floor (Kat)</label>
                <input
                  v-model.number="newResearch.floor"
                  type="number"
                  placeholder="e.g. 2"
                />
              </div>
              <div class="form-field">
                <label>Total Floors (Toplam Kat)</label>
                <input
                  v-model.number="newResearch.total_floors"
                  type="number"
                  placeholder="e.g. 5"
                />
              </div>

              <div class="form-field">
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
                  >Internal Notes / Comments (Raporda görünür)
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

        <section class="admin-section card">
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
                  placeholder="Locaiton"
                  class="filter-input"
                  style="
                    padding: 0.5rem 0.75rem;
                    border-radius: 8px;
                    border: 1px solid #eee;
                    width: 140px;
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
                <tr v-for="item in filteredResearchListings" :key="item.id">
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

                <tr v-if="researchListings.length === 0">
                  <td colspan="9" class="empty-msg">
                    No research properties found.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-view {
  background-color: var(--background-light);
  min-height: 100vh;
}

.admin-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 4rem 1rem;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-light);
  width: 100%;
  height: 5rem;
}

.header-branding {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.admin-logo-img {
  height: 140px;
  width: auto;
  object-fit: contain;
  background: transparent;
  mix-blend-mode: multiply; /* Helps blend if white bg, otherwise use transparent png/webp */
}

.admin-title {
  color: var(--primary);
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  margin-top: 2rem; /* Moving text slightly upwards to align better with logo text */
  letter-spacing: -0.01em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.role-badge {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.25rem 0.6rem;
  border-radius: 99px;
  letter-spacing: 0.05em;
}

.role-badge.superuser {
  background: #dcfce7;
  color: #166534;
}
.role-badge.editor {
  background: #fef9c3;
  color: #854d0e;
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

.unread-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background-color: #ef4444;
  color: white;
  font-size: 0.65rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 99px;
  z-index: 10;
}

.logout-btn {
  background: none;
  border: 1px solid var(--primary);
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  text-transform: uppercase;
}

.admin-tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.admin-tabs button {
  background: none;
  border: none;
  padding: 0.75rem 1.5rem;
  font-weight: 700;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.admin-tabs button.active {
  color: var(--primary);
  border-bottom-color: var(--accent);
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
  border-collapse: collapse;
}

.property-list th {
  text-align: left;
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #6b7280;
  padding: 1rem;
  border-bottom: 1px solid var(--border-light);
}

.property-list td {
  padding: 1rem;
  border-bottom: 1px solid var(--border-light);
  font-size: 0.9rem;
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
</style>
