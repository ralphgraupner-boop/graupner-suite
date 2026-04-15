import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const TOOLBAR_FULL = [
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["clean"],
];

const TOOLBAR_COMPACT = [
  ["bold", "italic", "underline"],
  [{ color: [] }],
  ["clean"],
];

const RichTextEditor = ({ value, onChange, placeholder, compact = false, className = "" }) => {
  return (
    <div className={`rich-text-editor ${compact ? "compact" : ""} ${className}`}>
      <ReactQuill
        theme="snow"
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        modules={{ toolbar: compact ? TOOLBAR_COMPACT : TOOLBAR_FULL }}
      />
    </div>
  );
};

export { RichTextEditor };
