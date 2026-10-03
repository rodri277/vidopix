import { Component, type ErrorInfo, type ReactNode } from 'react';
import { DEFAULT_LANGUAGE, isLanguage, translate } from '../i18n';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.failed) {
      const current = document.documentElement.lang;
      const language = isLanguage(current) ? current : DEFAULT_LANGUAGE;
      return (
        <main role="alert">
          <h1>{translate(language, 'error.title')}</h1>
          <p>{translate(language, 'error.body')}</p>
        </main>
      );
    }
    return this.props.children;
  }
}
