
import React from 'react';
import ReactDOM from 'react-dom/client';

const isMobile = () => {
  return window.innerWidth < 768 || /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const App = isMobile() ? React.lazy(() => import('./mobile/App')) : React.lazy(() => import('./App'));

root.render(
  <React.StrictMode>
    <React.Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-black text-white">Loading...</div>}>
      <App />
    </React.Suspense>
  </React.StrictMode>
);
