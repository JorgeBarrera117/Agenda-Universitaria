import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Componente de captura y recuperación de excepciones no controladas en React
 * 
 * Previene pantallas en blanco desiertas cuando un componente falla durante el renderizado,
 * mostrando una superficie Material Design 3 con opciones de recuperación para el estudiante.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Excepción capturada en árbol de componentes:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[340px] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 rounded-[28px] p-6 sm:p-8 shadow-lg text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center ring-4 ring-amber-500/10">
              <AlertTriangle className="w-7 h-7 stroke-[2.2]" />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-black text-[#191C20] dark:text-[#E2E2E6] tracking-tight">
                {this.props.fallbackTitle || 'Algo no salió como esperábamos'}
              </h3>
              <p className="text-xs sm:text-sm text-[#43474E] dark:text-[#8C9199] mt-1.5 leading-relaxed">
                Se produjo una excepción inesperada al renderizar esta sección. Tus datos locales en la agenda permanecen seguros.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-2xl bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 border border-[#C3C7D0]/40 dark:border-[#43474E]/40 text-left overflow-x-auto text-[11px] font-mono text-red-600 dark:text-red-400 max-h-32">
                <span className="font-bold">{this.state.error.name}: </span>
                {this.state.error.message}
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#00639B] hover:bg-[#005282] dark:bg-[#92CCFF] dark:hover:bg-[#72BAF5] dark:text-[#003353] shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                <span>Reintentar acción</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold text-[#43474E] dark:text-[#C3C7D0] bg-[#E2E7EF] dark:bg-[#272A2F] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76] active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recargar aplicación</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
