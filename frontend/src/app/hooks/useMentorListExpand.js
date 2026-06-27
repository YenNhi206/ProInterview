import { useState, useEffect, useMemo } from "react";
import { MENTOR_LIST_PAGE_SIZE } from "../components/mentor/MentorListExpandButton.jsx";

export function useMentorListExpand(items, resetKey) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [resetKey]);

  const visibleItems = useMemo(() => {
    if (expanded) return items;
    return items.slice(0, MENTOR_LIST_PAGE_SIZE);
  }, [items, expanded]);

  const showExpandButton = items.length > MENTOR_LIST_PAGE_SIZE;

  return {
    expanded,
    visibleItems,
    showExpandButton,
    toggleExpanded: () => setExpanded((value) => !value),
  };
}
