import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { toast } from '@/components/ui/toast'

const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
        toast.add({
            title: 'Nueva versión disponible',
            type: 'info',
            timeout: 0,
            actionProps: {
                children: 'Actualizar',
                onClick: () => {
                    void updateSW(true)
                },
            },
        })
    },
})

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
