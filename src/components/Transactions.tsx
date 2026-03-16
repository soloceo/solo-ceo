import { TransactionsView, Toast } from "./Money";
import { useToast } from "../hooks/useToast";

export default function Transactions() {
  const [toast, showToast] = useToast();

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      <Toast message={toast} />
      <TransactionsView showToast={showToast} />
    </div>
  );
}
