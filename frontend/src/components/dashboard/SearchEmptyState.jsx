import { Search } from "lucide-react";
import EmptyState from "@/components/dashboard/EmptyState";

export default function SearchEmptyState({ message, testId = "search-empty" }) {
  return (
    <EmptyState
      icon={Search}
      title={message}
      compact
      testId={testId}
    />
  );
}
