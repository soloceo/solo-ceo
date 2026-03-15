import { useState, useCallback } from "react";
import { PlansView } from "./Money";
import { Toast } from "./Money";

export default function Plans() {
  const [toast, setToast] = useState("");
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      <Toast message={toast} />
      <PlansView showToast={showToast} />
    </div>
  );
}
