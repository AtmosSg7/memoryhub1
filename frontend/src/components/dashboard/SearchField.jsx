import { forwardRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SEARCH_FIELD_CLASS,
  SEARCH_ICON_CLASS,
  SEARCH_ICON_WRAPPER_CLASS,
} from "@/components/dashboard/detailModalLayout";

const SearchField = forwardRef(function SearchField(
  { className, wrapperClassName, iconClassName, inputClassName, type = "search", ...props },
  ref
) {
  return (
    <div className={cn(SEARCH_ICON_WRAPPER_CLASS, wrapperClassName, className)}>
      <Search className={cn(SEARCH_ICON_CLASS, iconClassName)} aria-hidden="true" />
      <input
        ref={ref}
        type={type}
        className={cn(SEARCH_FIELD_CLASS, inputClassName)}
        autoComplete="off"
        {...props}
      />
    </div>
  );
});

export default SearchField;
