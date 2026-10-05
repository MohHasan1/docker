import React from "react";
import logo from "./logo.svg";
import "./App.css";
import { BrowserRouter as Router, Route, NavLink } from "react-router-dom";
import OtherPage from "./OtherPage";
import Fib from "./Fib";

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <div className="App-brand">
            <img src={logo} className="App-logo" alt="logo" />
            <span>Fib Calculator by hasan</span>
          </div>
          <nav className="App-nav">
            <NavLink exact to="/" activeClassName="active">
              Home
            </NavLink>
            <NavLink to="/otherpage" activeClassName="active">
              Other Page
            </NavLink>
          </nav>
        </header>
        <main className="App-main">
          <Route exact path="/" component={Fib} />
          <Route path="/otherpage" component={OtherPage} />
        </main>
      </div>
    </Router>
  );
}

export default App;
