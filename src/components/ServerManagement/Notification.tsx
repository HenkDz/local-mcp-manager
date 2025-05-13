import type React from 'react';

export interface NotificationProps {
  message: string;
  type: 'error' | 'success' | 'info';
  title?: string;
  onDismiss?: () => void; // Optional dismiss handler
}

const Notification: React.FC<NotificationProps> = ({ message, type, title, onDismiss }) => {
  if (!message) {
    return null;
  }

  let bgColor = '';
  let borderColor = '';
  let textColor = '';
  let iconPath = '';
  let defaultTitle = '';

  switch (type) {
    case 'error':
      bgColor = 'bg-red-50';
      borderColor = 'border-red-300';
      textColor = 'text-red-700';
      defaultTitle = 'Error';
      iconPath = "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z";
      break;
    case 'success':
      bgColor = 'bg-green-50';
      borderColor = 'border-green-300';
      textColor = 'text-green-700';
      defaultTitle = 'Success';
      iconPath = "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z";
      break;
    // case 'info': // Removed as it behaves identically to default
    default:
      bgColor = 'bg-blue-50';
      borderColor = 'border-blue-300';
      textColor = 'text-blue-700';
      defaultTitle = 'Information';
      iconPath = "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"; // Example info icon
      break;
  }

  const displayTitle = title || defaultTitle;

  return (
    <div className={`border ${borderColor} ${bgColor} ${textColor} px-4 py-3 rounded-md mb-4 relative`}>
      <div className="flex">
        <div className="py-1">
          <svg className="fill-current h-6 w-6 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <title>{displayTitle}</title>
            <path d={iconPath} />
          </svg>
        </div>
        <div>
          <p className="font-medium">{displayTitle}</p>
          <p className="text-sm">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-0 bottom-0 right-0 px-4 py-3"
          aria-label="Dismiss"
        >
          <svg className="fill-current h-6 w-6 opacity-50 hover:opacity-75" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <title>Dismiss</title>
            <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
          </svg>
        </button>
      )}
    </div>
  );
};

export default Notification; 