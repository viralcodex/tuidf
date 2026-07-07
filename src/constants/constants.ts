import { homedir } from "os";
import path from "path";
import type { StatusType } from "../model";

export const OUTPUT_DIR = path.join(homedir(), "Documents", "TuiDF");

export const toolsMenu = [
  { name: "Organise PDF", command: "organise" },
  { name: "Merge PDFs", command: "merge" },
  { name: "Split/Extract PDF", command: "splitExtract" },
  { name: "Compress PDF", command: "compress" },
  { name: "Rotate PDF", command: "rotate" },
  { name: "Delete Pages", command: "delete" },
  { name: "PDF to Images", command: "pdfToImages" },
  { name: "Images to PDF", command: "imagesToPDF" },
  { name: "Encrypt PDF", command: "protect" },
  { name: "Decrypt PDF", command: "decrypt" },
  { name: "Page Numbers", command: "pageNumbers" },
];

export const EmptyBorderChars = {
  topLeft: "",
  bottomLeft: "",
  vertical: "",
  topRight: "",
  bottomRight: "",
  bottomT: "",
  topT: "",
  cross: "",
  leftT: "",
  rightT: "",
  horizontal: "",
};

export const HIGHLIGHT_ACCENT_COLOR = "#dfe7ef";

export const STATUS_COLORS: Record<StatusType, string> = {
  error: "red",
  success: "green",
  info: "white",
};

export const osaScript = `set theFiles to choose file of type {{{type}}} with prompt "Select files" with multiple selections allowed
set output to ""
repeat with f in theFiles
set output to output & POSIX path of f & "\\n"
end repeat
return output`;

export const windowsScript = `Add-Type -AssemblyName System.Windows.Forms; $ofd = New-Object System.Windows.Forms.OpenFileDialog; $ofd.Filter = "{{type}}"; $ofd.Multiselect = $true; if ($ofd.ShowDialog() -eq "OK") { $ofd.FileNames -join [Environment]::NewLine }`;

export const linuxScript = `zenity --file-selection --title="Select PDF files" --file-filter="{{type}}" --multiple --separator="\n"`;
