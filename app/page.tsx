"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  Plus, Download, Upload, Trash2, GripVertical, ListOrdered, Copy, Check, 
  ArrowUpToLine, Eraser, ChevronLeft, ChevronRight, AlertTriangle, Info, Search, 
  ExternalLink, X, Clock, FileSpreadsheet, SlidersHorizontal, CheckCircle2 
} from "lucide-react";

// ――― 定数・型定義 ―――
const COLUMNS = [
  { name: "OP", width: "w-12" },
  { name: "出番", width: "w-16" },
  { name: "選手名", width: "w-48" },
  { name: "会員番号", width: "w-24" },
  { name: "馬名", width: "w-48" },
  { name: "登録番号", width: "w-24" },
  { name: "所属", width: "w-72" },
];

// 高コントラスト交差カラーパレット（暖色・寒色が交互に配置され違いが分かりやすい）
const COLOR_PALETTE = [
  "bg-sky-100 border-sky-300 text-sky-900",
  "bg-rose-100 border-rose-300 text-rose-900",
  "bg-amber-100 border-amber-300 text-amber-900",
  "bg-indigo-100 border-indigo-300 text-indigo-900",
  "bg-emerald-100 border-emerald-300 text-emerald-900",
  "bg-orange-100 border-orange-300 text-orange-900",
  "bg-purple-100 border-purple-300 text-purple-900",
  "bg-lime-100 border-lime-300 text-lime-900",
  "bg-cyan-100 border-cyan-300 text-cyan-900",
  "bg-fuchsia-100 border-fuchsia-300 text-fuchsia-900",
  "bg-yellow-100 border-yellow-300 text-yellow-900",
  "bg-blue-100 border-blue-300 text-blue-900",
  "bg-teal-100 border-teal-300 text-teal-900",
  "bg-pink-100 border-pink-300 text-pink-900",
];

type RowData = { id: string; values: string[] };
type TabData = { id: string; name: string; rows: RowData[] };
type SearchResult = { tabId: string; tabName: string; rowIndex: number; row: RowData };

type IntervalWarning = {
  riderWarning?: { minGap: number; targetName: string };
  horseWarning?: { minGap: number; targetName: string };
};

type HoveredMatch = {
  type: "rider" | "horse";
  name: string;
} | null;

const createEmptyRows = (count: number): RowData[] =>
  Array.from({ length: count }, () => ({
    id: crypto.randomUUID(),
    values: Array(7).fill(""),
  }));

const HighlightMatch = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <>{text}</>;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="font-bold text-emerald-600 bg-emerald-100 px-0.5 rounded">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};

// ――― タブコンポーネント ―――
const SortableTab = ({ tab, isActive, onSelect, onUpdateName, onDelete }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tab.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(tab.id)}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg cursor-grab transition-all ${
        isActive 
          ? "bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.05)] border-t-2 border-emerald-500 relative z-10" 
          : "bg-slate-200 hover:bg-slate-300 text-slate-500"
      }`}
    >
      <input
        type="text"
        value={tab.name}
        onChange={(e) => onUpdateName(tab.id, e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`bg-transparent outline-none font-semibold w-20 text-xs sm:text-sm cursor-text ${
          isActive ? "text-emerald-900" : "text-slate-600"
        }`}
      />
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(tab.id, tab.name); }} 
        onPointerDown={(e) => e.stopPropagation()}
        className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
        title="タブを削除"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
};

// ――― 行コンポーネント ―――
const SortableRow = ({ 
  row, 
  rowIndex, 
  updateCell, 
  handlePaste, 
  duplicateColors, 
  intervalWarnings, 
  suggestions, 
  onContextMenu,
  hoveredMatch,
  onHoverCell,
  onLeaveCell
}: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  
  const [focusedCol, setFocusedCol] = useState<number | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const rowWarning = intervalWarnings[rowIndex] as IntervalWarning | undefined;

  // ホバー中の重複強調表示の判定
  const isRiderMatchHovered = hoveredMatch?.type === "rider" && row.values[2].trim() !== "" && row.values[2].trim() === hoveredMatch.name;
  const isHorseMatchHovered = hoveredMatch?.type === "horse" && row.values[4].trim() !== "" && row.values[4].trim() === hoveredMatch.name;
  const isRowMatchHovered = isRiderMatchHovered || isHorseMatchHovered;

  useEffect(() => {
    if (dropdownRef.current && activeSuggestionIndex >= 0) {
      const container = dropdownRef.current;
      const activeItem = container.children[activeSuggestionIndex] as HTMLElement;
      if (activeItem) {
        const itemTop = activeItem.offsetTop;
        const itemBottom = itemTop + activeItem.clientHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;

        if (itemTop < containerTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > containerBottom) {
          container.scrollTop = itemBottom - container.clientHeight;
        }
      }
    }
  }, [activeSuggestionIndex]);

  return (
    <tr 
      ref={setNodeRef} 
      data-row-index={rowIndex}
      style={style} 
      onContextMenu={(e) => onContextMenu(e, rowIndex)}
      className={`border-b border-slate-100 transition-all duration-150 group ${
        isRowMatchHovered
          ? "bg-emerald-50/90 ring-2 ring-emerald-400 ring-inset z-20"
          : "bg-white hover:bg-slate-50/80"
      } ${focusedCol !== null ? "relative z-40" : "relative z-10"}`}
    >
      <td className="p-0 text-center">
        <button {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity p-1">
          <GripVertical size={14} />
        </button>
      </td>
      {row.values.map((val: string, colIndex: number) => {
        let styleColor = "bg-transparent";
        if (colIndex === 2 && duplicateColors.rider[val]) styleColor = duplicateColors.rider[val];
        if (colIndex === 4 && duplicateColors.horse[val]) styleColor = duplicateColors.horse[val];

        const isRiderWarning = colIndex === 2 && rowWarning?.riderWarning;
        const isHorseWarning = colIndex === 4 && rowWarning?.horseWarning;
        const warningInfo = isRiderWarning ? rowWarning?.riderWarning : isHorseWarning ? rowWarning?.horseWarning : null;

        const colSuggestions = (colIndex === 2 ? suggestions.riders : colIndex === 4 ? suggestions.horses : colIndex === 6 ? suggestions.affiliations : []);
        
        const filteredSuggestions = val.length > 0 
          ? colSuggestions.filter((s: string) => s !== val && s.toLowerCase().includes(val.toLowerCase())) 
          : [];

        // ホバー対象セルかの個別判定
        const isThisCellHovered = (colIndex === 2 && isRiderMatchHovered) || (colIndex === 4 && isHorseMatchHovered);

        return (
          <td 
            key={colIndex} 
            className={`p-0 relative transition-colors ${styleColor} ${isThisCellHovered ? "ring-2 ring-emerald-600 bg-emerald-100" : ""}`}
            onMouseEnter={() => {
              if ((colIndex === 2 || colIndex === 4) && val.trim()) {
                onHoverCell(colIndex === 2 ? "rider" : "horse", val.trim());
              }
            }}
            onMouseLeave={() => {
              if (colIndex === 2 || colIndex === 4) {
                onLeaveCell();
              }
            }}
          >
            <div className="flex items-center w-full h-full relative">
              <input
                type="text"
                value={val}
                onFocus={() => {
                  setFocusedCol(colIndex);
                  setActiveSuggestionIndex(-1);
                }}
                onBlur={() => {
                  setFocusedCol(null);
                  setActiveSuggestionIndex(-1);
                }}
                onChange={(e) => {
                  updateCell(rowIndex, colIndex, e.target.value);
                  setActiveSuggestionIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (focusedCol === colIndex && filteredSuggestions.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveSuggestionIndex((prev) => Math.min(prev + 1, filteredSuggestions.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === "Enter") {
                      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < filteredSuggestions.length) {
                        e.preventDefault();
                        updateCell(rowIndex, colIndex, filteredSuggestions[activeSuggestionIndex]);
                        setFocusedCol(null);
                      }
                    }
                  }
                }}
                onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                className="w-full h-full px-2 py-1 bg-transparent outline-none transition-all duration-150 focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:relative focus:z-10 text-slate-700 text-xs sm:text-sm"
                autoComplete="off"
              />

              {/* 連投・近接出番警告バッジ */}
              {warningInfo && (
                <div 
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex items-center gap-0.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow shrink-0 pointer-events-none"
                  title={`近接出番警告: 前後の出番との間隔が${warningInfo.minGap}出番しかありません！`}
                >
                  <AlertTriangle size={10} />
                  <span>間隔 {warningInfo.minGap}</span>
                </div>
              )}
            </div>
            
            {focusedCol === colIndex && filteredSuggestions.length > 0 && (
              <div ref={dropdownRef} className="absolute top-full left-0 w-full mt-0.5 bg-white border border-emerald-200 shadow-xl z-50 max-h-40 overflow-y-auto rounded-md flex flex-col overflow-hidden">
                {filteredSuggestions.map((suggestion: string, i: number) => {
                  const isActive = i === activeSuggestionIndex;
                  return (
                    <div
                      key={suggestion}
                      onMouseEnter={() => setActiveSuggestionIndex(i)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        updateCell(rowIndex, colIndex, suggestion);
                        setFocusedCol(null);
                      }}
                      className={`px-3 py-1.5 text-xs sm:text-sm cursor-pointer border-b border-slate-50 last:border-none transition-colors ${
                        isActive ? "bg-emerald-50 text-emerald-800 font-medium" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      <HighlightMatch text={suggestion} query={val} />
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
};

// ――― メインアプリケーション ―――
export default function EquestrianApp() {
  const [tournamentName, setTournamentName] = useState<string>("");
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  // 出番間隔閾値（連投判定基準）
  const [minIntervalThreshold, setMinIntervalThreshold] = useState<number>(5);
  const [isAnalyzerOpen, setIsAnalyzerOpen] = useState<boolean>(false);

  // ホバー結び線用ステート
  const [hoveredMatch, setHoveredMatch] = useState<HoveredMatch>(null);
  const [hoverBrackets, setHoverBrackets] = useState<{ top: number; height: number; gap: number }[]>([]);

  // 全体検索機能ステート
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [activeSearchSuggestionIndex, setActiveSearchSuggestionIndex] = useState<number>(-1);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; rowIndex: number | null; customText?: string }>({
    visible: false, x: 0, y: 0, rowIndex: null
  });

  // カスタムモーダル
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    type: "alert" | "confirm";
    confirmLabel?: string;
    confirmColor?: string;
    onConfirm?: () => void;
  }>({ isOpen: false, title: "", message: "", type: "alert" });

  useEffect(() => {
    const saved = localStorage.getItem("equestrian-data-v3");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTabs(parsed.tabs || []);
        setActiveTabId(parsed.activeTabId || "");
        setTournamentName(parsed.tournamentName || "");
        if (parsed.minIntervalThreshold !== undefined) setMinIntervalThreshold(parsed.minIntervalThreshold);
      } catch (e) {
        console.error(e);
      }
    } else {
      const initialTab = { id: crypto.randomUUID(), name: "第1競技", rows: createEmptyRows(100) };
      setTabs([initialTab]);
      setActiveTabId(initialTab.id);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("equestrian-data-v3", JSON.stringify({ 
        tabs, activeTabId, tournamentName, minIntervalThreshold 
      }));
    }
  }, [tabs, activeTabId, tournamentName, minIntervalThreshold, isLoaded]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu((prev) => ({ ...prev, visible: false }));
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }));

  const showAlert = (title: string, message: string) => {
    setModal({ isOpen: true, title, message, type: "alert" });
  };

  const showConfirm = (title: string, message: string | React.ReactNode, confirmLabel: string, confirmColor: string, onConfirm: () => void) => {
    setModal({ isOpen: true, title, message, type: "confirm", confirmLabel, confirmColor, onConfirm });
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const addTab = () => {
    const newTab = { id: crypto.randomUUID(), name: `新競技 ${tabs.length + 1}`, rows: createEmptyRows(100) };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setTimeout(() => scrollTabs("right"), 100);
  };

  const updateTabName = (id: string, name: string) => setTabs(tabs.map((t) => (t.id === id ? { ...t, name } : t)));

  const requestDeleteTab = (id: string, name: string) => {
    if (tabs.length === 1) {
      showAlert("削除エラー", "最後のタブは削除できません。");
      return;
    }
    showConfirm(
      "タブの削除確認",
      `「${name}」を削除しますか？\nこのタブのデータは完全に失われます。`,
      "削除する", "bg-red-600 hover:bg-red-700",
      () => {
        const newTabs = tabs.filter((t) => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) setActiveTabId(newTabs[0].id);
      }
    );
  };

  const exportJSON = () => {
    const dataObj = { tabs, activeTabId, tournamentName, minIntervalThreshold };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `${tournamentName || "Order-list"}-settings.json`;
    a.click();
  };

  const exportCSV = () => {
    let csvContent = "\uFEFF競技名,OP,出番,選手名,会員番号,馬名,登録番号,所属\n";
    tabs.forEach((tab) => {
      tab.rows.forEach((row) => {
        const hasData = row.values.some((v) => v.trim() !== "");
        if (hasData) {
          const rowStr = [tab.name, ...row.values].map((v) => `"${v.replace(/"/g, '""')}"`).join(",");
          csvContent += rowStr + "\n";
        }
      });
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tournamentName || "大会出番表"}_一括データ.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setTabs(parsed.tabs);
        setActiveTabId(parsed.activeTabId);
        setTournamentName(parsed.tournamentName || "");
      } catch (err) {
        showAlert("エラー", "ファイルの読み込みに失敗しました。形式が正しいか確認してください。");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const requestClearAllData = () => {
    showConfirm(
      "全データのクリア確認",
      "全てのタブのデータを削除し、初期状態に戻します。\n本当によろしいですか？",
      "全データ消去", "bg-red-600 hover:bg-red-700",
      () => {
        const initialTab = { id: crypto.randomUUID(), name: "第1競技", rows: createEmptyRows(100) };
        setTabs([initialTab]);
        setActiveTabId(initialTab.id);
        setTournamentName("");
      }
    );
  };

  const requestClearCurrentTab = () => {
    if (!activeTab) return;
    showConfirm(
      "タブデータの消去確認",
      `「${activeTab.name}」のデータをすべて消去し、空行に戻します。\n本当によろしいですか？`,
      "データを消去", "bg-red-600 hover:bg-red-700",
      () => {
        setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: createEmptyRows(100) } : t)));
      }
    );
  };

  const scrollTabs = (direction: "left" | "right") => {
    if (tabContainerRef.current) {
      const scrollAmount = 300;
      tabContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    if (!activeTab) return;
    const newRows = [...activeTab.rows];
    newRows[rowIndex].values[colIndex] = value;
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRow: number, startCol: number) => {
    e.preventDefault();
    if (!activeTab) return;

    const pasteData = e.clipboardData.getData("text");
    const pasteRows = pasteData.split("\n").map((row) => row.split("\t"));
    const newRows = [...activeTab.rows];

    pasteRows.forEach((row, rIdx) => {
      if (startRow + rIdx >= newRows.length) return;
      row.forEach((cellVal, cIdx) => {
        if (startCol + cIdx < 7) {
          newRows[startRow + rIdx].values[startCol + cIdx] = cellVal.replace(/\r/g, "");
        }
      });
    });
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
  };

  const renumberOrder = () => {
    if (!activeTab) return;
    const newRows = activeTab.rows.map((row, idx) => {
      const newValues = [...row.values];
      newValues[1] = (idx + 1).toString();
      return { ...row, values: newValues };
    });
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
  };

  const copyToClipboard = async () => {
    if (!activeTab) return;
    let lastValidRowIndex = -1;
    for (let i = activeTab.rows.length - 1; i >= 0; i--) {
      if (activeTab.rows[i].values[2].trim() !== "") {
        lastValidRowIndex = i;
        break;
      }
    }
    if (lastValidRowIndex === -1) {
      showAlert("コピーエラー", "コピーできるデータ（選手名）がありません。");
      return;
    }
    const rowsToCopy = activeTab.rows.slice(0, lastValidRowIndex + 1);
    const rowStrings = rowsToCopy.map((row) => row.values.join("\t"));
    const copyString = rowStrings.join("\n");
    try {
      await navigator.clipboard.writeText(copyString);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      showAlert("エラー", "クリップボードへのコピーに失敗しました。");
    }
  };

  const handleContextMenu = (e: React.MouseEvent, rowIndex: number, customText?: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      rowIndex: rowIndex,
      customText: customText
    });
  };

  const handleCopySingleRow = async () => {
    if (contextMenu.customText !== undefined) {
      try {
        await navigator.clipboard.writeText(contextMenu.customText);
      } catch (err) {
        showAlert("エラー", "コピーに失敗しました。");
      }
    } else if (contextMenu.rowIndex !== null && activeTab) {
      const targetRow = activeTab.rows[contextMenu.rowIndex];
      const copyString = targetRow.values.join("\t");
      try {
        await navigator.clipboard.writeText(copyString);
      } catch (err) {
        showAlert("エラー", "コピーに失敗しました。");
      }
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleInsertRowAbove = () => {
    if (contextMenu.rowIndex === null || !activeTab) return;
    const newEmptyRow = { id: crypto.randomUUID(), values: Array(7).fill("") };
    const newRows = [...activeTab.rows];
    newRows.splice(contextMenu.rowIndex, 0, newEmptyRow);
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleDeleteSingleRow = () => {
    if (contextMenu.rowIndex === null || !activeTab) return;
    const newRows = activeTab.rows.filter((_, idx) => idx !== contextMenu.rowIndex);
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleRowDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id && activeTab) {
      const oldIndex = activeTab.rows.findIndex((r) => r.id === active.id);
      const newIndex = activeTab.rows.findIndex((r) => r.id === over.id);
      const newRows = arrayMove(activeTab.rows, oldIndex, newIndex);
      setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
    }
  };

  const handleTabDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = tabs.findIndex((t) => t.id === active.id);
      const newIndex = tabs.findIndex((t) => t.id === over.id);
      setTabs(arrayMove(tabs, oldIndex, newIndex));
    }
  };

  // ホバー結び線計算処理（絶対スクロール位置基準で完全に正確に計算）
  const handleHoverCell = useCallback((type: "rider" | "horse", name: string) => {
    setHoveredMatch({ type, name });
  }, []);

  const handleLeaveCell = useCallback(() => {
    setHoveredMatch(null);
    setHoverBrackets([]);
  }, []);

  useEffect(() => {
    if (!hoveredMatch || !activeTab || !tableBodyRef.current || !tableWrapperRef.current) {
      setHoverBrackets([]);
      return;
    }

    const colIdx = hoveredMatch.type === "rider" ? 2 : 4;
    const matchingRowIndices: number[] = [];

    activeTab.rows.forEach((r, idx) => {
      if (r.values[colIdx].trim() === hoveredMatch.name) {
        matchingRowIndices.push(idx);
      }
    });

    if (matchingRowIndices.length <= 1) {
      setHoverBrackets([]);
      return;
    }

    const rowEls = tableBodyRef.current.querySelectorAll("tr[data-row-index]");
    const wrapperRect = tableWrapperRef.current.getBoundingClientRect();
    const scrollTop = tableWrapperRef.current.scrollTop;
    const brackets: { top: number; height: number; gap: number }[] = [];

    for (let i = 0; i < matchingRowIndices.length - 1; i++) {
      const r1 = matchingRowIndices[i];
      const r2 = matchingRowIndices[i + 1];

      const el1 = rowEls[r1] as HTMLElement;
      const el2 = rowEls[r2] as HTMLElement;

      if (el1 && el2) {
        const rect1 = el1.getBoundingClientRect();
        const rect2 = el2.getBoundingClientRect();

        // テーブル全体のスクロールコンテナを基準とした絶対Y座標計算（1行上のズレを完全修正）
        const top1 = (rect1.top - wrapperRect.top) + scrollTop + rect1.height / 2;
        const top2 = (rect2.top - wrapperRect.top) + scrollTop + rect2.height / 2;
        const height = top2 - top1;
        const gap = r2 - r1 - 1; // 間に入っている頭（出番）数

        brackets.push({ top: top1, height, gap });
      }
    }

    setHoverBrackets(brackets);
  }, [hoveredMatch, activeTab]);

  // 1. 単一タブ内限定の重複マーク ＆ 2. 近接出番（連投）警告ロジック
  const { duplicateColors, intervalWarnings, tournamentAnalytics } = useMemo(() => {
    if (!activeTab) return { duplicateColors: { rider: {}, horse: {} }, intervalWarnings: {}, tournamentAnalytics: [] };

    // --- 単一タブ内での重複マーク計算 ---
    const riderCounts: Record<string, number> = {};
    const horseCounts: Record<string, number> = {};

    activeTab.rows.forEach((r) => {
      const rider = r.values[2].trim();
      const horse = r.values[4].trim();
      if (rider) riderCounts[rider] = (riderCounts[rider] || 0) + 1;
      if (horse) horseCounts[horse] = (horseCounts[horse] || 0) + 1;
    });

    const riderColors: Record<string, string> = {};
    const horseColors: Record<string, string> = {};
    let colorIdx = 0;

    Object.keys(riderCounts).forEach((k) => {
      if (riderCounts[k] > 1) riderColors[k] = COLOR_PALETTE[(colorIdx++) % COLOR_PALETTE.length];
    });
    Object.keys(horseCounts).forEach((k) => {
      if (horseCounts[k] > 1) horseColors[k] = COLOR_PALETTE[(colorIdx++) % COLOR_PALETTE.length];
    });

    // --- 連投・出番間隔警告計算 ---
    const warnings: Record<number, IntervalWarning> = {};
    const riderLastSeenIdx: Record<string, number> = {};
    const horseLastSeenIdx: Record<string, number> = {};

    activeTab.rows.forEach((r, idx) => {
      const rider = r.values[2].trim();
      const horse = r.values[4].trim();

      if (rider) {
        if (riderLastSeenIdx[rider] !== undefined) {
          const gap = idx - riderLastSeenIdx[rider];
          if (gap <= minIntervalThreshold) {
            warnings[idx] = { ...(warnings[idx] || {}), riderWarning: { minGap: gap, targetName: rider } };
            const prevIdx = riderLastSeenIdx[rider];
            warnings[prevIdx] = { ...(warnings[prevIdx] || {}), riderWarning: { minGap: gap, targetName: rider } };
          }
        }
        riderLastSeenIdx[rider] = idx;
      }

      if (horse) {
        if (horseLastSeenIdx[horse] !== undefined) {
          const gap = idx - horseLastSeenIdx[horse];
          if (gap <= minIntervalThreshold) {
            warnings[idx] = { ...(warnings[idx] || {}), horseWarning: { minGap: gap, targetName: horse } };
            const prevIdx = horseLastSeenIdx[horse];
            warnings[prevIdx] = { ...(warnings[prevIdx] || {}), horseWarning: { minGap: gap, targetName: horse } };
          }
        }
        horseLastSeenIdx[horse] = idx;
      }
    });

    // --- 大会全体の出番間隔アナライザー用データ ---
    const analyticsMap: Record<string, { type: "rider" | "horse"; name: string; totalEntries: number; entries: { tabName: string; order: string; index: number }[] }> = {};

    tabs.forEach((tab) => {
      tab.rows.forEach((row, rowIdx) => {
        const rider = row.values[2].trim();
        const horse = row.values[4].trim();
        const orderVal = row.values[1].trim() || `${rowIdx + 1}`;

        if (rider) {
          const key = `rider_${rider}`;
          if (!analyticsMap[key]) analyticsMap[key] = { type: "rider", name: rider, totalEntries: 0, entries: [] };
          analyticsMap[key].totalEntries++;
          analyticsMap[key].entries.push({ tabName: tab.name, order: orderVal, index: rowIdx });
        }
        if (horse) {
          const key = `horse_${horse}`;
          if (!analyticsMap[key]) analyticsMap[key] = { type: "horse", name: horse, totalEntries: 0, entries: [] };
          analyticsMap[key].totalEntries++;
          analyticsMap[key].entries.push({ tabName: tab.name, order: orderVal, index: rowIdx });
        }
      });
    });

    const tournamentAnalytics = Object.values(analyticsMap).filter((item) => item.totalEntries > 1);

    return {
      duplicateColors: { rider: riderColors, horse: horseColors },
      intervalWarnings: warnings,
      tournamentAnalytics: tournamentAnalytics
    };
  }, [activeTab, tabs, minIntervalThreshold]);

  const suggestions = useMemo(() => {
    const riders = new Set<string>();
    const horses = new Set<string>();
    const affiliations = new Set<string>();
    const allValues = new Set<string>();

    tabs.forEach((tab) => {
      tab.rows.forEach((row) => {
        row.values.forEach((v) => {
          const val = v.trim();
          if (val) allValues.add(val);
        });
        if (row.values[2].trim()) riders.add(row.values[2].trim());
        if (row.values[4].trim()) horses.add(row.values[4].trim());
        if (row.values[6].trim()) affiliations.add(row.values[6].trim());
      });
    });

    return {
      riders: Array.from(riders),
      horses: Array.from(horses),
      affiliations: Array.from(affiliations),
      all: Array.from(allValues)
    };
  }, [tabs]);

  const filteredSearchSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return suggestions.all.filter((item) => item.toLowerCase().includes(query)).slice(0, 10);
  }, [searchQuery, suggestions.all]);

  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const results: SearchResult[] = [];
    tabs.forEach((tab) => {
      tab.rows.forEach((row, rowIndex) => {
        const match = row.values.some((val) => val.toLowerCase().includes(query));
        if (match) {
          results.push({ tabId: tab.id, tabName: tab.name, rowIndex: rowIndex, row: row });
        }
      });
    });
    return results;
  }, [searchQuery, tabs]);

  const handleExecuteSearch = (queryToSearch?: string) => {
    const targetQuery = queryToSearch !== undefined ? queryToSearch : searchQuery;
    if (!targetQuery.trim()) {
      showAlert("検索エラー", "検索キーワードを入力してください。");
      return;
    }
    setSearchQuery(targetQuery);
    setIsSearchFocused(false);
    setIsSearchModalOpen(true);
  };

  const handleJumpToTab = (tabId: string) => {
    setActiveTabId(tabId);
    setIsSearchModalOpen(false);
  };

  if (!isLoaded || !activeTab) return null;

  return (
    <div className="h-screen bg-slate-100 p-2 sm:p-3 font-sans text-slate-800 flex flex-col overflow-hidden">
      <div className="w-full max-w-[98%] xl:max-w-7xl mx-auto h-full flex flex-col min-h-0">
        
        {/* ヘッダー＆コントロール */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2 bg-white px-3.5 py-2.5 rounded-xl shadow-sm border border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xl" role="img" aria-label="horse">🐴</span>
              <h1 className="text-base font-bold tracking-tight text-slate-800 shrink-0">
                Order List Helper
              </h1>
            </div>
            <input
              type="text"
              placeholder="大会名を入力 (例: 第3回 〇〇馬術大会)"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              className="flex-1 text-xs sm:text-sm font-medium text-slate-700 placeholder-slate-400 border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none py-0.5 bg-transparent transition-colors min-w-[120px]"
            />
          </div>

          {/* 検索ウィンドウ */}
          <div className="relative min-w-[180px] sm:min-w-[240px] flex-1 max-w-xs">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="全シート検索 (選手/馬名/所属)"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchFocused(true);
                  setActiveSearchSuggestionIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (isSearchFocused && filteredSearchSuggestions.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveSearchSuggestionIndex((prev) => Math.min(prev + 1, filteredSearchSuggestions.length - 1));
                      return;
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveSearchSuggestionIndex((prev) => Math.max(prev - 1, 0));
                      return;
                    } else if (e.key === "Enter" && activeSearchSuggestionIndex >= 0) {
                      e.preventDefault();
                      const selected = filteredSearchSuggestions[activeSearchSuggestionIndex];
                      setSearchQuery(selected);
                      handleExecuteSearch(selected);
                      return;
                    }
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleExecuteSearch();
                  }
                }}
                className="w-full pl-8 pr-14 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50 focus:bg-white transition-all"
              />
              <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <button
                onClick={() => handleExecuteSearch()}
                className="absolute right-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium rounded transition-colors"
              >
                検索
              </button>
            </div>

            {isSearchFocused && filteredSearchSuggestions.length > 0 && (
              <div
                ref={searchDropdownRef}
                className="absolute top-full left-0 w-full mt-1 bg-white border border-emerald-200 shadow-2xl z-50 max-h-52 overflow-y-auto rounded-lg flex flex-col"
              >
                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 bg-slate-50 border-b border-slate-100">
                  候補一覧 (Enterで検索)
                </div>
                {filteredSearchSuggestions.map((suggestion, i) => {
                  const isActive = i === activeSearchSuggestionIndex;
                  return (
                    <div
                      key={suggestion}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery(suggestion);
                        handleExecuteSearch(suggestion);
                      }}
                      className={`px-3 py-1.5 text-xs cursor-pointer border-b border-slate-50 last:border-none transition-colors flex items-center justify-between ${
                        isActive ? "bg-emerald-50 text-emerald-800 font-medium" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      <span><HighlightMatch text={suggestion} query={searchQuery} /></span>
                      <Search size={11} className="text-slate-300" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 出番間隔・アナライザーボタン */}
            <button
              onClick={() => setIsAnalyzerOpen(true)}
              className="flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-800 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors shadow-sm font-semibold text-xs"
              title="大会全体の重複出番・出番間隔の分析画面を開く"
            >
              <Clock size={13} className="text-amber-600" />
              <span>出番間隔分析</span>
              {tournamentAnalytics.length > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 rounded-full font-bold ml-0.5">
                  {tournamentAnalytics.length}
                </span>
              )}
            </button>

            <button onClick={exportCSV} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium text-xs" title="Excelで開けるCSVファイルを出力">
              <FileSpreadsheet size={13} className="text-emerald-600" /> CSV
            </button>
            <button onClick={exportJSON} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium text-xs" title="設定保存 (JSON)">
              <Download size={13} /> 保存
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium text-xs">
              <Upload size={13} /> 読込
            </button>
            <input type="file" accept=".json" ref={fileInputRef} onChange={importData} className="hidden" />
            <button onClick={requestClearAllData} className="p-1 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors shadow-sm" title="全データ初期化">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* タブ領域と右側のアクションボタン */}
        <div className="flex justify-between items-end px-1 mb-0 shrink-0 mt-1">
          <div className="flex items-center mr-3 min-w-0" style={{ flex: "1 1 auto" }}>
            <button 
              onClick={() => scrollTabs("left")} 
              className="p-1 mb-0.5 bg-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-300 rounded-l-md transition-colors shrink-0"
              title="左へスクロール"
            >
              <ChevronLeft size={14} />
            </button>
            
            <div 
              ref={tabContainerRef} 
              className="flex overflow-x-auto overflow-y-hidden scroll-smooth" 
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <div className="flex gap-1 px-1">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
                  <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
                    {tabs.map((tab) => (
                      <SortableTab
                        key={tab.id}
                        tab={tab}
                        isActive={activeTabId === tab.id}
                        onSelect={setActiveTabId}
                        onUpdateName={updateTabName}
                        onDelete={requestDeleteTab}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>

            <button 
              onClick={() => scrollTabs("right")} 
              className="p-1 mb-0.5 bg-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-300 rounded-r-md transition-colors shrink-0"
              title="右へスクロール"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            <button 
              onClick={addTab} 
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-slate-300 rounded-t-md transition-colors text-xs font-medium"
            >
              <Plus size={13} /> タブ追加
            </button>
            
            <button 
              onClick={requestClearCurrentTab} 
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-100 rounded-t-md transition-colors text-xs font-medium"
              title="現在のタブのデータを空行にリセット"
            >
              <Eraser size={13} /> タブ消去
            </button>

            <button 
              onClick={copyToClipboard} 
              className={`flex items-center gap-1 px-2.5 py-1 rounded-t-md transition-colors text-xs font-medium shadow-sm ${
                isCopied 
                  ? "bg-emerald-500 text-white" 
                  : "bg-white border border-slate-200 border-b-0 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {isCopied ? <Check size={13} /> : <Copy size={13} />}
              {isCopied ? "コピー完了" : "Excelコピー"}
            </button>
            
            <button 
              onClick={renumberOrder} 
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-white hover:bg-slate-700 rounded-t-md transition-colors text-xs font-medium shadow-sm"
              title="出番を1番から順に振り直し"
            >
              <ListOrdered size={13} /> 出番振り直し
            </button>
          </div>
        </div>

        {/* 表領域 */}
        <div ref={tableWrapperRef} className="bg-white rounded-b-xl rounded-tl-xl shadow-lg border border-slate-200 flex-1 min-h-0 overflow-y-auto relative z-0">
          <table className="w-full border-collapse table-fixed relative">
            <colgroup>
              <col className="w-8" />
              {COLUMNS.map((col, idx) => (
                <col key={idx} className={col.width} />
              ))}
            </colgroup>
            <thead className="bg-slate-800 text-white sticky top-0 z-30 shadow-sm">
              <tr className="text-xs tracking-wider">
                <th className="py-2 px-1 font-medium"></th>
                {COLUMNS.map((col, idx) => (
                  <th key={idx} className="py-2 px-2 text-left font-semibold">{col.name}</th>
                ))}
              </tr>
            </thead>
            <tbody ref={tableBodyRef} className="relative">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRowDragEnd}>
                <SortableContext items={activeTab.rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  {activeTab.rows.map((row, rowIndex) => (
                    <SortableRow
                      key={row.id}
                      row={row}
                      rowIndex={rowIndex}
                      updateCell={updateCell}
                      handlePaste={handlePaste}
                      duplicateColors={duplicateColors}
                      intervalWarnings={intervalWarnings}
                      suggestions={suggestions}
                      onContextMenu={handleContextMenu}
                      hoveredMatch={hoveredMatch}
                      onHoverCell={handleHoverCell}
                      onLeaveCell={handleLeaveCell}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </tbody>
          </table>

          {/* ホバー時カッコ描画（位置ずれ修正 ＆ 表示範囲を少し左側に配置して見切れ防止） */}
          {hoverBrackets.map((bracket, i) => (
            <div
              key={i}
              className="absolute right-12 pointer-events-none z-30 flex items-center justify-end animate-in fade-in duration-150"
              style={{
                top: `${bracket.top}px`,
                height: `${bracket.height}px`,
                width: "36px",
              }}
            >
              <div className="w-full h-full border-r-2 border-t-2 border-b-2 border-emerald-500 rounded-r-xl relative shadow-sm">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1 border border-white">
                  <span>間 {bracket.gap} 頭</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* カスタム右クリックメニュー */}
      {contextMenu.visible && (
        <div
          className="fixed z-[150] bg-white border border-slate-200 shadow-xl rounded-lg py-1 min-w-[170px] overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            onClick={handleCopySingleRow}
            className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 transition-colors"
          >
            <Copy size={13} /> この行をコピー
          </button>
          {contextMenu.customText === undefined && (
            <>
              <button
                onClick={handleInsertRowAbove}
                className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 transition-colors"
              >
                <ArrowUpToLine size={13} /> 上に空行を追加
              </button>
              <button
                onClick={handleDeleteSingleRow}
                className="w-full text-left px-3.5 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
              >
                <Trash2 size={13} /> この行を削除
              </button>
            </>
          )}
        </div>
      )}

      {/* 出番間隔分析モーダル */}
      {isAnalyzerOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-amber-400" />
                <h3 className="text-base font-bold">出番間隔・複数エントリー分析</h3>
              </div>
              <button onClick={() => setIsAnalyzerOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* モーダル内ヘッダー：連投警告の閾値設定 */}
            <div className="bg-amber-50/80 px-5 py-2.5 border-b border-amber-200/60 flex items-center justify-between text-xs text-amber-900 shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-amber-700 shrink-0" />
                <span className="font-semibold">連投・近接判定の間隔閾値:</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={minIntervalThreshold}
                  onChange={(e) => setMinIntervalThreshold(Number(e.target.value))}
                  className="bg-white border border-amber-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                >
                  <option value={2}>2 出番以下（直後）</option>
                  <option value={3}>3 出番以下</option>
                  <option value={5}>5 出番以下（標準）</option>
                  <option value={8}>8 出番以下</option>
                  <option value={10}>10 出番以下</option>
                </select>
                <span className="text-slate-500 text-[11px]">※設定値以下の出番間隔に⚠️バッジが表示されます</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {tournamentAnalytics.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm flex flex-col items-center gap-2">
                  <CheckCircle2 size={32} className="text-emerald-500 opacity-60" />
                  <span>複数回エントリーされている選手・馬匹はありません。</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-slate-600 font-medium px-1">
                    全競技（全タブ）を通して2回以上エントリーされている選手および馬匹の一覧です。
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tournamentAnalytics.map((item, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:border-amber-300 transition-colors">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                          <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${item.type === "rider" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>
                              {item.type === "rider" ? "選手" : "馬匹"}
                            </span>
                            <span>{item.name}</span>
                          </div>
                          <span className="text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                            計 {item.totalEntries} 出番
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          {item.entries.map((entry, eIdx) => (
                            <div key={eIdx} className="flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded text-slate-600">
                              <span className="font-semibold text-slate-700">{entry.tabName}</span>
                              <span className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[11px]">
                                出番 #{entry.order}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-2.5 bg-white border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 shrink-0">
              <span>💡 同じ競技内での重複出番はメイン画面上で自動的に色分け表示されます。</span>
              <button onClick={() => setIsAnalyzerOpen(false)} className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全体検索結果モーダル */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Search size={18} className="text-emerald-400" />
                <h3 className="text-base font-bold">検索結果一覧</h3>
                <span className="text-xs bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full ml-2">
                  キーワード: 「<span className="text-emerald-300 font-semibold">{searchQuery}</span>」 ({searchResults.length}件該当)
                </span>
              </div>
              <button onClick={() => setIsSearchModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {searchResults.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">該当するデータが見つかりませんでした。</div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full border-collapse text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="py-2 px-3 border-r border-slate-200 bg-slate-200/60 w-32">対象競技 (タブ)</th>
                        {COLUMNS.map((col, idx) => (
                          <th key={idx} className="py-2 px-2.5 border-r border-slate-200 last:border-r-0">{col.name}</th>
                        ))}
                        <th className="py-2 px-3 text-center w-24">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((result, idx) => {
                        const rowCopyStr = result.row.values.join("\t");
                        return (
                          <tr
                            key={`${result.tabId}-${result.rowIndex}-${idx}`}
                            onContextMenu={(e) => handleContextMenu(e, result.rowIndex, rowCopyStr)}
                            className="border-b border-slate-100 hover:bg-emerald-50/50 transition-colors group"
                          >
                            <td className="py-2 px-3 font-semibold text-emerald-900 bg-slate-50 border-r border-slate-200 group-hover:bg-emerald-100/40">
                              {result.tabName}
                            </td>
                            {result.row.values.map((val, cIdx) => (
                              <td key={cIdx} className="py-2 px-2.5 border-r border-slate-100 last:border-r-0 text-slate-700">
                                <HighlightMatch text={val} query={searchQuery} />
                              </td>
                            ))}
                            <td className="py-1.5 px-2 text-center">
                              <button
                                onClick={() => handleJumpToTab(result.tabId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-[11px] transition-colors shadow-sm"
                              >
                                <ExternalLink size={12} /> 移動
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-5 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <div>💡 検索結果の行を右クリックすると、その行のデータ（競技名を除く7項目）をコピーできます。</div>
              <button onClick={() => setIsSearchModalOpen(false)} className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カスタム モーダル */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4">
              <div className="flex items-center gap-2.5 mb-3">
                {modal.type === "confirm" ? (
                  <AlertTriangle className="text-amber-500 shrink-0" size={22} />
                ) : (
                  <Info className="text-emerald-500 shrink-0" size={22} />
                )}
                <h3 className="text-base font-bold text-slate-800">{modal.title}</h3>
              </div>
              <p className="text-slate-600 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                {modal.message}
              </p>
            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-100">
              {modal.type === "confirm" && (
                <button 
                  onClick={closeModal} 
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
              )}
              <button 
                onClick={() => {
                  if (modal.onConfirm) modal.onConfirm();
                  closeModal();
                }} 
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium text-white rounded-lg transition-colors shadow-sm ${modal.type === "confirm" ? modal.confirmColor : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                {modal.type === "confirm" ? modal.confirmLabel : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}