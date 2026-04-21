import { ref } from "vue";

const isOpen = ref(false);
const propertyContext = ref(null);

export function useContact() {
  const openContact = (context = null) => {
    propertyContext.value = context;
    isOpen.value = true;
  };

  const closeContact = () => {
    isOpen.value = false;
    propertyContext.value = null;
  };

  return {
    isOpen,
    propertyContext,
    openContact,
    closeContact,
  };
}
