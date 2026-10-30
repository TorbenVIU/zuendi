import { useEffect, useState } from "react";

export type Section = "requests" | "variables";

type Props = {
  section: Section | null;
  onNavigate: (section: Section) => void;
};

const canOpenTab = () =>
  typeof chrome !== "undefined" && chrome.tabs !== undefined;

export const Toolbar = ({ section, onNavigate }: Props) => {
  const [isInTab, setIsInTab] = useState(true);

  useEffect(() => {
    if (!canOpenTab()) return;
    // getCurrent() resolves to undefined inside the side panel.
    chrome.tabs.getCurrent().then((tab) => setIsInTab(tab !== undefined));
  }, []);

  const openInTab = () =>
    chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });

  return (
    <header className="toolbar">
      <h1 className="toolbar__title">Zündi</h1>
      <nav className="toolbar__nav">
        <button
          className={`toolbar__tab ${section === "requests" ? "toolbar__tab--active" : ""}`}
          onClick={() => onNavigate("requests")}
        >
          Requests
        </button>
        <button
          className={`toolbar__tab ${section === "variables" ? "toolbar__tab--active" : ""}`}
          onClick={() => onNavigate("variables")}
        >
          Variablen
        </button>
      </nav>
      {!isInTab && (
        <button
          className="button button--ghost button--small"
          title="In neuem Tab öffnen"
          onClick={openInTab}
        >
          ↗
        </button>
      )}
    </header>
  );
};
