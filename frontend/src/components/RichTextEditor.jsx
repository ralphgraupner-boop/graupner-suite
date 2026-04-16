import { useRef, useEffect, useCallback } from "react";

const RichTextEditor = ({ value, onChange, placeholder, compact = false, className = "" }) => {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== (value || "")) {
        editorRef.current.innerHTML = value || "";
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const handleInput = useCallback(() => {
    isInternalChange.current = true;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const execCommand = (cmd, val) => {
    document.execCommand(cmd, false, val || null);
    editorRef.current?.focus();
    handleInput();
  };

  const btnClass = "px-2 py-1 text-sm font-medium rounded hover:bg-muted transition-colors";

  return (
    <div className={`rich-text-editor border rounded-sm overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className={`flex items-center gap-0.5 border-b bg-muted/50 ${compact ? "px-2 py-1" : "px-3 py-1.5"}`}>
        <button type="button" onClick={() => execCommand("bold")} className={`${btnClass} font-bold`} title="Fett">B</button>
        <button type="button" onClick={() => execCommand("italic")} className={`${btnClass} italic`} title="Kursiv">I</button>
        <button type="button" onClick={() => execCommand("underline")} className={`${btnClass} underline`} title="Unterstrichen">U</button>
        <span className="w-px h-5 bg-border mx-1" />
        <label className={`${btnClass} cursor-pointer relative`} title="Textfarbe">
          A
          <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={e => execCommand("foreColor", e.target.value)} />
        </label>
        {!compact && (
          <label className={`${btnClass} cursor-pointer relative bg-yellow-100`} title="Hintergrund">
            A
            <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={e => execCommand("hiliteColor", e.target.value)} />
          </label>
        )}
        <span className="w-px h-5 bg-border mx-1" />
        <button type="button" onClick={() => execCommand("removeFormat")} className={`${btnClass} text-muted-foreground text-xs`} title="Formatierung entfernen">Tx</button>
      </div>
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        data-placeholder={placeholder}
        className={`outline-none text-sm leading-relaxed ${compact ? "min-h-[60px] px-3 py-2" : "min-h-[100px] px-3 py-3"} empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground`}
        style={{ wordBreak: "break-word" }}
      />
    </div>
  );
};

export { RichTextEditor };
