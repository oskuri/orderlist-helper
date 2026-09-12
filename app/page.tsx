"use client";

/* STREAMING_CHUNK:Imports and Initial Setup */
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Download, Upload, Trash2, GripVertical, ListOrdered, Copy, Check, ArrowUpToLine, Eraser, ChevronLeft, ChevronRight, AlertTriangle, Info } from "lucide-react";

// ――― 定数・型定義 ―――
const COLUMNS = [
{ name: "OP", width: "w-12" },
{ name: "出番", width: "w-16" },
{ name: "選手名", width: "w-48" },
{ name: "会員番号", width: "w-20" },
{ name: "馬名", width: "w-48" },
{ name: "登録番号", width: "w-20" },
{ name: "所属", width: "w-72" },
];

const COLOR_PALETTE = [
"bg-red-100", "bg-orange-100", "bg-amber-100", "bg-yellow-100",
"bg-lime-100", "bg-green-100", "bg-emerald-100", "bg-teal-100",
"bg-cyan-100", "bg-sky-100", "bg-blue-100", "bg-indigo-100",
"bg-purple-100", "bg-fuchsia-100", "bg-pink-100", "bg-rose-100",
"bg-red-200", "bg-yellow-200", "bg-emerald-200", "bg-blue-200",
"bg-purple-200", "bg-pink-200", "bg-orange-200", "bg-teal-200"
];

type RowData = { id: string; values: string[] };
type TabData = { id: string; name: string; rows: RowData[] };

/* STREAMING_CHUNK:Helper Functions and Highlight Component */
const createEmptyRows = (count: number): RowData[] =>
Array.from({ length: count }, () => ({
id: crypto.randomUUID(),
values: Array(7).fill(""),
}));

const HighlightMatch = ({ text, query }: { text: string; query: string }) => {
if (!query) return <>{text}</>;
const parts = text.split(new RegExp((${query}), 'gi'));
return (
<>
{parts.map((part, i) =>
part.toLowerCase() === query.toLowerCase()
? {part}
: part
)}
</>
);
};

/* STREAMING_CHUNK:Sortable Tab Component */
// ――― タブコンポーネント（ドラッグ＆ドロップ対応） ―――
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
className={shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-t-lg cursor-grab transition-all ${ isActive  ? 'bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] border-t-2 border-emerald-500 relative z-10'  : 'bg-slate-200 hover:bg-slate-300 text-slate-500' }}
>
<input
type="text"
value={tab.name}
onChange={(e) => onUpdateName(tab.id, e.target.value)}
onPointerDown={(e) => e.stopPropagation()}
onClick={(e) => e.stopPropagation()}
className={bg-transparent outline-none font-semibold w-24 text-sm cursor-text ${ isActive ? 'text-emerald-900' : 'text-slate-600' }}
/>
<button
onClick={(e) => { e.stopPropagation(); onDelete(tab.id, tab.name); }}
onPointerDown={(e) => e.stopPropagation()}
className="text-slate-400 hover:text-red-500 transition-colors"
>



);
};

/* STREAMING_CHUNK:Sortable Row Component Configuration */
// ――― 行コンポーネント（ドラッグ＆ドロップ対応） ―――
const SortableRow = ({ row, rowIndex, updateCell, handlePaste, duplicateColors, suggestions, onContextMenu }: any) => {
const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id });
const style = { transform: CSS.Transform.toString(transform), transition };

const [focusedCol, setFocusedCol] = useState<number | null>(null);
const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
const dropdownRef = useRef(null);

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

/* STREAMING_CHUNK:Sortable Row Render */
return (
<tr
ref={setNodeRef}
style={style}
onContextMenu={(e) => onContextMenu(e, rowIndex)}
className={border-b border-slate-100 bg-white hover:bg-slate-50 transition-colors group ${focusedCol !== null ? 'relative z-40' : 'relative z-10'}}
>

<button {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity">



{row.values.map((val: string, colIndex: number) => {
let bgColor = "bg-transparent";
if (colIndex === 2 && duplicateColors.rider[val]) bgColor = duplicateColors.rider[val];
if (colIndex === 4 && duplicateColors.horse[val]) bgColor = duplicateColors.horse[val];

    const colSuggestions = (colIndex === 2 ? suggestions.riders : colIndex === 4 ? suggestions.horses : colIndex === 6 ? suggestions.affiliations : []);
    
    const filteredSuggestions = val.length > 0 
      ? colSuggestions.filter((s: string) => s !== val && s.toLowerCase().includes(val.toLowerCase())) 
      : [];

    return (
      <td key={colIndex} className={`p-0 relative ${bgColor}`}>
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
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestionIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestionIndex(prev => Math.max(prev - 1, 0));
              } else if (e.key === 'Enter') {
                if (activeSuggestionIndex >= 0 && activeSuggestionIndex < filteredSuggestions.length) {
                  e.preventDefault();
                  updateCell(rowIndex, colIndex, filteredSuggestions[activeSuggestionIndex]);
                  setFocusedCol(null);
                }
              }
            }
          }}
          onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
          className="w-full h-full px-3 py-2.5 bg-transparent outline-none transition-all duration-150 focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:relative focus:z-10 text-slate-700 text-sm"
          autoComplete="off"
        />
        
        {focusedCol === colIndex && filteredSuggestions.length > 0 && (
          <div ref={dropdownRef} className="absolute top-full left-0 w-full mt-1 bg-white border border-emerald-200 shadow-xl z-50 max-h-48 overflow-y-auto rounded-md flex flex-col overflow-hidden">
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
                  className={`px-3 py-2.5 text-sm cursor-pointer border-b border-slate-50 last:border-none transition-colors ${
                    isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
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

/* STREAMING_CHUNK:Main Application State */
// ――― メインアプリケーション ―――
export default function EquestrianApp() {
const [tournamentName, setTournamentName] = useState("");
const [tabs, setTabs] = useState<TabData[]>([]);
const [activeTabId, setActiveTabId] = useState("");
const [isLoaded, setIsLoaded] = useState(false);
const [isCopied, setIsCopied] = useState(false);
const fileInputRef = useRef(null);

const tabContainerRef = useRef(null);

const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; rowIndex: number | null }>({
visible: false, x: 0, y: 0, rowIndex: null
});

// カスタムモーダル（アラート＆確認用）の状態管理
const [modal, setModal] = useState<{
isOpen: boolean;
title: string;
message: string | React.ReactNode;
type: 'alert' | 'confirm';
confirmLabel?: string;
confirmColor?: string;
onConfirm?: () => void;
}>({ isOpen: false, title: '', message: '', type: 'alert' });

/* STREAMING_CHUNK:Effects and Modal Helpers */
useEffect(() => {
const saved = localStorage.getItem("equestrian-data");
if (saved) {
const parsed = JSON.parse(saved);
setTabs(parsed.tabs || []);
setActiveTabId(parsed.activeTabId || "");
setTournamentName(parsed.tournamentName || "");
} else {
const initialTab = { id: crypto.randomUUID(), name: "第1競技", rows: createEmptyRows(100) };
setTabs([initialTab]);
setActiveTabId(initialTab.id);
}
setIsLoaded(true);
}, []);

useEffect(() => {
if (isLoaded) {
localStorage.setItem("equestrian-data", JSON.stringify({ tabs, activeTabId, tournamentName }));
}
}, [tabs, activeTabId, tournamentName, isLoaded]);

useEffect(() => {
const handleClickOutside = () => setContextMenu((prev) => ({ ...prev, visible: false }));
window.addEventListener("click", handleClickOutside);
return () => window.removeEventListener("click", handleClickOutside);
}, []);

// モーダルを閉じる
const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

// カスタムアラートを表示
const showAlert = (title: string, message: string) => {
setModal({ isOpen: true, title, message, type: 'alert' });
};

// カスタム確認ダイアログを表示
const showConfirm = (title: string, message: string | React.ReactNode, confirmLabel: string, confirmColor: string, onConfirm: () => void) => {
setModal({ isOpen: true, title, message, type: 'confirm', confirmLabel, confirmColor, onConfirm });
};

/* STREAMING_CHUNK:Tab and Data Actions */
const activeTab = tabs.find((t) => t.id === activeTabId);

const addTab = () => {
const newTab = { id: crypto.randomUUID(), name: 新競技 ${tabs.length + 1}, rows: createEmptyRows(100) };
setTabs([...tabs, newTab]);
setActiveTabId(newTab.id);
setTimeout(() => scrollTabs('right'), 100);
};

const updateTabName = (id: string, name: string) => setTabs(tabs.map(t => t.id === id ? { ...t, name } : t));

const requestDeleteTab = (id: string, name: string) => {
if (tabs.length === 1) {
showAlert("削除エラー", "最後のタブは削除できません。");
return;
}
showConfirm(
"タブの削除",
「${name}」を削除しますか？\nこのタブのデータは完全に失われます。,
"削除する", "bg-red-600 hover:bg-red-700",
() => {
const newTabs = tabs.filter(t => t.id !== id);
setTabs(newTabs);
if (activeTabId === id) setActiveTabId(newTabs[0].id);
}
);
};

const exportData = () => {
const dataObj = { tabs, activeTabId, tournamentName };
const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj));
const a = document.createElement("a");
a.href = dataStr;
a.download = ${tournamentName || "Order-list"}-settings.json;
a.click();
};

const importData = (e: React.ChangeEvent) => {
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
e.target.value = '';
};

const requestClearAllData = () => {
showConfirm(
"全データのクリア",
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
"タブデータの消去",
「${activeTab.name}」のデータをすべて消去し、空行に戻します。\n本当によろしいですか？,
"データを消去", "bg-red-600 hover:bg-red-700",
() => {
setTabs(tabs.map(t => t.id === activeTabId ? { ...t, rows: createEmptyRows(100) } : t));
}
);
};

const scrollTabs = (direction: 'left' | 'right') => {
if (tabContainerRef.current) {
const scrollAmount = 300;
tabContainerRef.current.scrollBy({
left: direction === 'left' ? -scrollAmount : scrollAmount,
behavior: 'smooth'
});
}
};

/* STREAMING_CHUNK:Table Cell Manipulation */
const updateCell = (rowIndex: number, colIndex: number, value: string) => {
if (!activeTab) return;
const newRows = [...activeTab.rows];
newRows[rowIndex].values[colIndex] = value;
setTabs(tabs.map(t => t.id === activeTabId ? { ...t, rows: newRows } : t));
};

const handlePaste = (e: React.ClipboardEvent, startRow: number, startCol: number) => {
e.preventDefault();
if (!activeTab) return;

const pasteData = e.clipboardData.getData("text");
const pasteRows = pasteData.split("\n").map(row => row.split("\t"));
const newRows = [...activeTab.rows];

pasteRows.forEach((row, rIdx) => {
  if (startRow + rIdx >= newRows.length) return;
  row.forEach((cellVal, cIdx) => {
    if (startCol + cIdx < 7) {
      newRows[startRow + rIdx].values[startCol + cIdx] = cellVal.replace(/\r/g, "");
    }
  });
});
setTabs(tabs.map(t => t.id === activeTabId ? { ...t, rows: newRows } : t));


};

const renumberOrder = () => {
if (!activeTab) return;
const newRows = activeTab.rows.map((row, idx) => {
const newValues = [...row.values];
newValues[1] = (idx + 1).toString();
return { ...row, values: newValues };
});
setTabs(tabs.map(t => t.id === activeTabId ? { ...t, rows: newRows } : t));
};

/* STREAMING_CHUNK:Clipboard and Context Menu */
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
const rowStrings = rowsToCopy.map(row => row.values.join("\t"));
const copyString = rowStrings.join("\n");
try {
await navigator.clipboard.writeText(copyString);
setIsCopied(true);
setTimeout(() => setIsCopied(false), 2000);
} catch (err) {
showAlert("エラー", "クリップボードへのコピーに失敗しました。");
}
};

const handleContextMenu = (e: React.MouseEvent, rowIndex: number) => {
e.preventDefault();
setContextMenu({
visible: true,
x: e.clientX,
y: e.clientY,
rowIndex: rowIndex
});
};

const handleCopySingleRow = async () => {
if (contextMenu.rowIndex === null || !activeTab) return;
const targetRow = activeTab.rows[contextMenu.rowIndex];
const copyString = targetRow.values.join("\t");

try {
  await navigator.clipboard.writeText(copyString);
} catch (err) {
  showAlert("エラー", "コピーに失敗しました。");
}
setContextMenu(prev => ({ ...prev, visible: false }));


};

const handleInsertRowAbove = () => {
if (contextMenu.rowIndex === null || !activeTab) return;
const newEmptyRow = { id: crypto.randomUUID(), values: Array(7).fill("") };
const newRows = [...activeTab.rows];
newRows.splice(contextMenu.rowIndex, 0, newEmptyRow);
setTabs(tabs.map(t => t.id === activeTabId ? { ...t, rows: newRows } : t));
setContextMenu(prev => ({ ...prev, visible: false }));
};

/* STREAMING_CHUNK:DND and Data Computations */
const sensors = useSensors(
useSensor(PointerSensor, {
activationConstraint: { distance: 5 },
}),
useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);

const handleRowDragEnd = (event: any) => {
const { active, over } = event;
if (active.id !== over.id && activeTab) {
const oldIndex = activeTab.rows.findIndex(r => r.id === active.id);
const newIndex = activeTab.rows.findIndex(r => r.id === over.id);
const newRows = arrayMove(activeTab.rows, oldIndex, newIndex);
setTabs(tabs.map(t => t.id === activeTabId ? { ...t, rows: newRows } : t));
}
};

const handleTabDragEnd = (event: any) => {
const { active, over } = event;
if (active.id !== over.id) {
const oldIndex = tabs.findIndex(t => t.id === active.id);
const newIndex = tabs.findIndex(t => t.id === over.id);
setTabs(arrayMove(tabs, oldIndex, newIndex));
}
};

const getDuplicateColors = useCallback(() => {
if (!activeTab) return { rider: {}, horse: {} };
const riderCounts: Record<string, number> = {};
const horseCounts: Record<string, number> = {};

activeTab.rows.forEach(r => {
  const rider = r.values[2];
  const horse = r.values[4];
  if (rider) riderCounts[rider] = (riderCounts[rider] || 0) + 1;
  if (horse) horseCounts[horse] = (horseCounts[horse] || 0) + 1;
});

const riderColors: Record<string, string> = {};
const horseColors: Record<string, string> = {};
let colorIdx = 0;

Object.keys(riderCounts).forEach(k => {
  if (riderCounts[k] > 1) riderColors[k] = COLOR_PALETTE[(colorIdx++) % COLOR_PALETTE.length];
});
Object.keys(horseCounts).forEach(k => {
  if (horseCounts[k] > 1) horseColors[k] = COLOR_PALETTE[(colorIdx++) % COLOR_PALETTE.length];
});

return { rider: riderColors, horse: horseColors };


}, [activeTab]);

const suggestions = useMemo(() => {
const riders = new Set();
const horses = new Set();
const affiliations = new Set();

tabs.forEach(tab => {
  tab.rows.forEach(row => {
    if (row.values[2].trim()) riders.add(row.values[2].trim());
    if (row.values[4].trim()) horses.add(row.values[4].trim());
    if (row.values[6].trim()) affiliations.add(row.values[6].trim());
  });
});

return {
  riders: Array.from(riders),
  horses: Array.from(horses),
  affiliations: Array.from(affiliations),
};


}, [tabs]);

if (!isLoaded || !activeTab) return null;

const duplicateColors = getDuplicateColors();

/* STREAMING_CHUNK:Main Render */
return (



    {/* ヘッダー＆コントロール（スクロールしない） */}
    <div className="flex justify-between items-end mb-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200 shrink-0">
      <div className="flex-1 w-full flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl" role="img" aria-label="horse">🐴</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Order List Helper
          </h1>
        </div>
        <input
          type="text"
          placeholder="大会名を入力 (例: 第3回 〇〇馬術大会)"
          value={tournamentName}
          onChange={(e) => setTournamentName(e.target.value)}
          className="w-3/4 text-lg font-medium text-slate-700 placeholder-slate-400 border-b-2 border-transparent hover:border-slate-200 focus:border-emerald-500 focus:outline-none py-1 bg-transparent transition-colors"
        />
      </div>
      
      <div className="flex gap-3">
        <button onClick={requestClearAllData} className="flex items-center gap-2 bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm font-medium text-sm">
          <Trash2 size={16} /> 全データクリア
        </button>
        <button onClick={exportData} className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium text-sm">
          <Download size={16} /> 保存 (エクスポート)
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium text-sm">
          <Upload size={16} /> 読込 (インポート)
        </button>
        <input type="file" accept=".json" ref={fileInputRef} onChange={importData} className="hidden" />
      </div>
    </div>

    {/* タブ領域と右側のアクションボタン（スクロールしない） */}
    <div className="flex justify-between items-end px-2 mb-0 shrink-0">
      <div className="flex items-center mr-4 min-w-0" style={{ flex: '1 1 auto' }}>
        <button 
          onClick={() => scrollTabs('left')} 
          className="p-2 mb-1 bg-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-300 rounded-l-lg transition-colors shrink-0"
          title="左へスクロール"
        >
          <ChevronLeft size={16} />
        </button>
        
        <div 
          ref={tabContainerRef} 
          className="flex overflow-x-auto overflow-y-hidden scroll-smooth" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex gap-1 px-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
              <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
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
          onClick={() => scrollTabs('right')} 
          className="p-2 mb-1 bg-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-300 rounded-r-lg transition-colors shrink-0"
          title="右へスクロール"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      
      <div className="flex items-center gap-1.5 shrink-0">
        <button 
          onClick={addTab} 
          className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-slate-300 rounded-t-lg transition-colors text-sm font-medium"
        >
          <Plus size={16} /> タブ追加
        </button>
        
        <button 
          onClick={requestClearCurrentTab} 
          className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-100 rounded-t-lg transition-colors text-sm font-medium"
          title="現在のタブのデータを空行にリセットします"
        >
          <Eraser size={16} /> タブ消去
        </button>

        <button 
          onClick={copyToClipboard} 
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg transition-colors text-sm font-medium shadow-sm ${
            isCopied 
              ? 'bg-emerald-500 text-white' 
              : 'bg-white border border-slate-200 border-b-0 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {isCopied ? <Check size={16} /> : <Copy size={16} />}
          {isCopied ? "コピー完了" : "Excelへコピー"}
        </button>
        
        <button 
          onClick={renumberOrder} 
          className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 text-white hover:bg-slate-700 rounded-t-lg transition-colors text-sm font-medium shadow-sm"
          title="出番を1番から順に振り直します"
        >
          <ListOrdered size={16} /> 出番振り直し
        </button>
      </div>
    </div>


/* STREAMING_CHUNK:Scrollable Table Area /
{/ 表領域（ここだけ縦にスクロールし、ヘッダーは固定される） */}

<div className="flex-1 overflow-y-auto pb-32" style={{ scrollbarWidth: 'thin' }}>



{COLUMNS.map((col, idx) => (

))}




{COLUMNS.map((col, idx) => (
{col.name}
))}




<SortableContext items={activeTab.rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
{activeTab.rows.map((row, rowIndex) => (

))}








/* STREAMING_CHUNK:Context Menu and Custom Modals /
{/ カスタム右クリックメニュー */}
{contextMenu.visible && (
<div
className="fixed z-[100] bg-white border border-slate-200 shadow-xl rounded-lg py-1.5 min-w-[180px] overflow-hidden"
style={{ top: contextMenu.y, left: contextMenu.x }}
onContextMenu={(e) => e.preventDefault()}
>

 この行をコピー


 上に空行を追加


)}

  {/* カスタム モーダル (アラート＆確認ポップアップ) */}
  {modal.isOpen && (
    <div className="fixed inset-0 z-[200] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            {modal.type === 'confirm' ? (
              <AlertTriangle className="text-amber-500" size={24} />
            ) : (
              <Info className="text-emerald-500" size={24} />
            )}
            <h3 className="text-lg font-bold text-slate-800">{modal.title}</h3>
          </div>
          <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
            {modal.message}
          </p>
        </div>
        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
          {modal.type === 'confirm' && (
            <button 
              onClick={closeModal} 
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </button>
          )}
          <button 
            onClick={() => {
              if (modal.onConfirm) modal.onConfirm();
              closeModal();
            }} 
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm ${modal.type === 'confirm' ? modal.confirmColor : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {modal.type === 'confirm' ? modal.confirmLabel : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )}

</div>


);
}
