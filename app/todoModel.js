// Based on: https://github.com/tastejs/todomvc/blob/gh-pages/examples/react/js/todoModel.js

import Appbase from "appbase-js";

import Utils from "./utils";
import Auth from './auth';

const ES_TYPE = "todo_reactjs";
const auth = new Auth();

const headers = () => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Authorization: `Bearer ${auth.getAccessToken()}`
});

const server = process.env.NODE_ENV === 'development' ? 'http://localhost:8000/' : 'https://todomvc.appbase.io/authorization/';

class TodoModel {
  constructor (key) {
    this.key = key;
    this.todos = [];
    this.onChanges = [];
    this.appbaseRef = new Appbase({
      url: "https://scalr.api.appbase.io",
      app: "todomvc-authorization",
      credentials: "qVAMNzBcP:f8e1ddba-ba82-435a-8918-2f90d57be7cf"
    });

    this.appbaseRef.search({
      type: ES_TYPE,
      size: 1000,
      body: {
        query: {
          match_all: {}
        }
      }
    }).on("data", ({hits: {hits = []} = {}} = {}) => {
      this.todos = hits.map(({_source = {}} = {}) => _source);
      this.inform();
    }).on("error", (error) => {
      console.log("caught a search error: ", error)
    });

    this.appbaseRef.searchStream({
      type: ES_TYPE,
      body: {
        query: {
          match_all: {}
        }
      }
    }).on("data", (stream) => {
      let {
        _deleted,
        _source
      } = stream;

      if (_deleted) {
        this.todos = this.todos.filter(function (candidate) {
          return candidate.id !== _source.id
        })
      } else if (_source) {
        const todo = this.todos.find(({id}) => id == _source.id);
        todo ? Object.assign(todo, _source) : this.todos.unshift(_source)
      }

      // this.todos = hits.map(({_source = {}} = {}) => _source)
      this.inform();
    }).on("error", (error) => {
      console.log("caught a searchStream, error: ", error)
    })
  }

  subscribe (onChange) {
    this.onChanges.push(onChange)
  }

  inform () {
    // Utils.store(this.key, this.todos)
    // this.todos = [...this.todos]
    this.onChanges.forEach((cb) => { cb() })
  }

  // returns all todos created by current user
  getValidTodos () {
    if (!auth.getUserEmail()) {
      return this.todos;
    }
    return this.todos.filter(todo => todo.createdBy === auth.getUserEmail());
  }

  // returns remaining todos
  getRemainingTodos () {
    if (!auth.getUserEmail()) {
      return this.todos;
    }
    return this.todos.filter(todo => todo.createdBy !== auth.getUserEmail());
  }

  addTodo (title) {
    const id = Utils.uuid();
    const now = Date.now();
    const jsonObject = {
      id,
      title,
      completed: false,
      createdAt: now
    };

    // optimistic logic
    this.todos = [jsonObject].concat(this.todos);
    this.inform();
    const payload = {
      title,
      id,
      createdAt: now,
      name: localStorage.name,
      avatar: localStorage.avatar
    }

    fetch(server, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(json => console.log(json))
  }

  toggleAll (checked) {
    console.log(checked)
    this.todos = [
      ...this.getValidTodos().map((todo) => ({
      ...todo,
      completed: checked
      })),
      ...this.getRemainingTodos()
    ];
    this.inform();

    this.getValidTodos().forEach((todo) => {
      const payload = {
        id: todo.id,
        completed: todo.completed
      }
  
      fetch(server, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(json => console.log(json))
    })
  }

  toggle (todoToToggle) {

    // optimistic logic
    this.todos = this.todos.map((todo) => {
      return todo !== todoToToggle ? todo : {
        ...todo,
        completed: !todo.completed
      }
    });
    this.inform();

    const payload = {
      id: todoToToggle.id,
      completed: !todoToToggle.completed
    }

    fetch(server, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(json => console.log(json))
  };

  destroy (todo) {
    // optimistic logic
    this.todos = this.todos.filter((candidate) => {
      return candidate !== todo
    });
    this.inform();

    const payload = {
      id: todo.id
    }

    fetch(server, {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(json => console.log(json))
  }

  save (todoToSave, text) {
    // optimistic logic
    this.todos = this.todos.map((todo) => {
      return todo !== todoToSave ? todo : {
        ...todo,
        title: text
      }
    });
    this.inform();

    const payload = {
      id: todoToSave.id,
      title: text
    }

    fetch(server, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(json => console.log(json))
  }

  clearCompleted () {
    let completed = this.getValidTodos().filter((todo) => todo.completed);

    // optimistic logic
    this.todos = [
      ...this.getValidTodos().filter((todo) => !todo.completed),
      ...this.getRemainingTodos()
    ];
    this.inform();

    // broadcast all changes
    completed.forEach((todo) => {
      const payload = {
        id: todo.id
      };

      fetch(server, {
        method: 'DELETE',
        headers: headers(),
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(json => console.log(json))
    })
  }
}

export default TodoModel;
