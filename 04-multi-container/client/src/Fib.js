import React, { Component } from 'react';
import axios from 'axios';

class Fib extends Component {
  state = {
    seenIndexes: [],
    values: {},
    index: '',
  };

  componentDidMount() {
    this.fetchAll();
    // the worker calculates in the background, so keep asking for fresh data
    this.interval = setInterval(this.fetchAll, 2000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  fetchAll = () => {
    this.fetchValues();
    this.fetchIndexes();
  };

  async fetchValues() {
    const values = await axios.get('/api/values/current');
    this.setState({ values: values.data });
  }

  async fetchIndexes() {
    const seenIndexes = await axios.get('/api/values/all');
    this.setState({
      seenIndexes: seenIndexes.data,
    });
  }

  handleSubmit = async (event) => {
    event.preventDefault();

    await axios.post('/api/values', {
      index: this.state.index,
    });
    this.setState({ index: '' });
    this.fetchAll();
  };

  renderSeenIndexes() {
    if (!this.state.seenIndexes.length) {
      return <p className="empty">Nothing yet. Submit an index to start.</p>;
    }

    return (
      <div className="chips">
        {this.state.seenIndexes.map(({ number }, i) => (
          <span className="chip" key={i}>
            {number}
          </span>
        ))}
      </div>
    );
  }

  renderValues() {
    const entries = [];

    for (let key in this.state.values) {
      entries.push(
        <div className="value-row" key={key}>
          <span>Index {key}</span>
          <strong>{this.state.values[key]}</strong>
        </div>
      );
    }

    if (!entries.length) {
      return <p className="empty">No calculated values yet.</p>;
    }

    return entries;
  }

  render() {
    return (
      <div className="fib">
        <section className="card">
          <h1>Fibonacci Calculator</h1>
          <p className="subtitle">
            Enter an index and the worker will calculate its value.
          </p>
          <form className="fib-form" onSubmit={this.handleSubmit}>
            <input
              type="number"
              min="0"
              placeholder="Enter your index"
              aria-label="Enter your index"
              value={this.state.index}
              onChange={(event) => this.setState({ index: event.target.value })}
            />
            <button>Submit</button>
          </form>
        </section>

        <section className="card">
          <h3>Indexes I have seen</h3>
          {this.renderSeenIndexes()}
        </section>

        <section className="card">
          <h3>Calculated values</h3>
          {this.renderValues()}
        </section>
      </div>
    );
  }
}

export default Fib;
