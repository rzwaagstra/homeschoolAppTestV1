import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import './index.css'
console.log('Homeschool HQ starting (homeschoolTestV1)');
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode>
    <ErrorBoundary><App/>    </ErrorBoundary>
  </React.StrictMode>)