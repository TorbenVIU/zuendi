import { useEffect, useRef, type ReactNode } from "react";

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  secondaryLabel?: string;
  onConfirm: () => void;
  onSecondary?: () => void;
};

type Props = ConfirmOptions & {
  onClose: () => void;
};

export const ConfirmDialog = ({
  title,
  body,
  confirmLabel,
  danger = false,
  secondaryLabel,
  onConfirm,
  onSecondary,
  onClose,
}: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const handleClose = () => {
    const choice = dialogRef.current?.returnValue;
    onClose();
    if (choice === "confirm") onConfirm();
    if (choice === "secondary") onSecondary?.();
  };

  return (
    <dialog ref={dialogRef} className="dialog" onClose={handleClose}>
      <form method="dialog">
        <h2 className="dialog__title">{title}</h2>
        {body && <div className="dialog__body">{body}</div>}
        <div className="dialog__actions">
          <button value="cancel" className="button" autoFocus>
            Abbrechen
          </button>
          {secondaryLabel && (
            <button value="secondary" className="button">
              {secondaryLabel}
            </button>
          )}
          <button
            value="confirm"
            className={`button ${danger ? "button--danger" : "button--primary"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
};
