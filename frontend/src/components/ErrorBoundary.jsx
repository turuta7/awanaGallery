import { Component } from 'react';

// Помилка в одній сторінці не повинна залишати весь сайт порожнім
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  // Перейшли на іншу сторінку — пробуємо показати знову
  componentDidUpdate(prev) {
    if (this.state.error && prev.route !== this.props.route) this.setState({ error: null });
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <p className="empty">
        Щось пішло не так 😕{' '}
        <a href="#/">На головну</a>
      </p>
    );
  }
}
