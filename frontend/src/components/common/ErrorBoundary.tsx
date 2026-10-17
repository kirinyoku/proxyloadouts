import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useInRouterContext, useLocation } from 'react-router-dom'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/sentry'
import i18n from '@/i18n'

export interface ErrorBoundaryProps {
  children: ReactNode
  resetKey?: string
}

interface State {
  hasError: boolean
  error: Error | null
  prevResetKey?: string
}

export class ErrorBoundaryClass extends Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, prevResetKey: props.resetKey }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: State): Partial<State> | null {
    if (props.resetKey !== undefined && props.resetKey !== state.prevResetKey) {
      return {
        hasError: false,
        error: null,
        prevResetKey: props.resetKey,
      }
    }
    return null
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, { componentStack: errorInfo.componentStack })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const t = (key: string) => i18n.t(key as any)
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex min-h-[50vh] flex-col items-center justify-center p-4"
        >
          <div className="card-zzz max-w-lg w-full p-6 text-center space-y-4 border-destructive/50 bg-card/95 shadow-2xl">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive border border-destructive/30">
              <AlertTriangle className="size-6" aria-hidden="true" />
            </div>

            <div className="space-y-1.5">
              <h2 className="font-heading text-lg font-bold uppercase tracking-wider text-foreground">
                {t('errorBoundary.title')}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('errorBoundary.description')}
              </p>
            </div>

            {this.state.error && (
              <div className="rounded-xl border border-destructive/20 bg-black/50 p-3 text-left">
                <p className="font-mono text-xs text-destructive break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="default"
                size="sm"
                onClick={this.handleReload}
                className="text-xs font-bold rounded-xl gap-1.5 cursor-pointer shadow-sm"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {t('errorBoundary.reload')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleGoHome}
                className="text-xs font-semibold rounded-xl gap-1.5 cursor-pointer border-white/10 hover:bg-white/5"
              >
                <Home className="size-3.5" aria-hidden="true" />
                {t('errorBoundary.goHome')}
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function ErrorBoundaryRouterSync({ children }: { children: ReactNode }) {
  const inRouter = useInRouterContext()
  if (inRouter) {
    return <ErrorBoundaryWithLocation>{children}</ErrorBoundaryWithLocation>
  }
  return <ErrorBoundaryClass>{children}</ErrorBoundaryClass>
}

function ErrorBoundaryWithLocation({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <ErrorBoundaryClass resetKey={location.key}>{children}</ErrorBoundaryClass>
}

/**
 * Global Error Boundary catching unhandled React render exceptions.
 * Automatically resets when the user navigates across routes via React Router.
 */
export function ErrorBoundary({ children, resetKey }: ErrorBoundaryProps) {
  if (resetKey !== undefined) {
    return <ErrorBoundaryClass resetKey={resetKey}>{children}</ErrorBoundaryClass>
  }
  return <ErrorBoundaryRouterSync>{children}</ErrorBoundaryRouterSync>
}
