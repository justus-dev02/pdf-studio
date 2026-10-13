import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import ErrorBoundary from './components/ui/ErrorBoundary'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element in index.html')

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
)
