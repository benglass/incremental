function now() {
  return (new Date()).getTime();
}

// Utility functions
var uuid = (function() {
  var id = now();
  return function() {
    id++;
    return id;
  };
})();

var publisherMethods = { 
    listen: function(subscriber, context) {
        if (!this.subscribers) {
            this.subscribers = [];
        }
        context = context || this;
        this.subscribers.push({ fn: subscriber, context });
    },
    trigger: function() {
        if (!this.subscribers) {
            this.subscribers = [];
        }
        const args = Array.prototype.slice.call(arguments);
        this.subscribers.forEach(function({ fn, context }) { 
          fn.apply(context, args);
        });
    }
};

function diffSeconds(startTimestamp, endTimestamp) {
  return Math.floor(
     (startTimestamp - endTimestamp) / 1000
  );
}

function padLeft(char, length, value) {
  if (value.length >= length) {
    return value;
  };
  return char.repeat(length - value.length) + value;
}

function formatSeconds(seconds) {
  const minutes = Math.floor(seconds / 60) % 60;
  const hours = Math.floor(seconds / 3600);
  const remainingSeconds = seconds % 60;
  const padTime = function(number) {
    return padLeft('0', 2, number.toString());
  }
  
  return `${padTime(hours)}:${padTime(minutes)}:${padTime(remainingSeconds)}`;
}

// Actions
function createAction() {
    var functor = function() {
        functor.trigger.apply(functor, Array.prototype.slice.call(arguments));
    };
    Object.assign(functor, publisherMethods);
    return functor;
}

var actions = {
  toggleTimerRunning: createAction(),
  updateTimerDescription: createAction(),
  createTimer: createAction(),
  stopTimer: createAction(),
  startTimer: createAction(),
  deleteTimer: createAction(),
};

// Store
const store = {
  subscribers: [],
  listen: function(subscriber) {
    this.subscribers.push(subscriber);
  },
  trigger: function(data) {
    this.subscribers.forEach(subscriber => subscriber(data));
  },
  data: {
    timers: [],
    currentTimerId: null,
  },
  getTimerById(id) {
    return this.data.timers.filter(function(timer) {
      return timer.id === id;
    })[0];
  },
  toggleTimerRunning: function(id) {
    const timer = this.getTimerById(id);
    if (timer.runningSince) {
      this.stopTimer(id);
    } else {
      this.startTimer(id);
    }
  },
  updateTimerDescription: function(id, description) {
    const timer = this.getTimerById(id);
    timer.description = description;
    this.trigger();
  },
  createTimer: function(description) {
    const timer = {
      description,
      id: uuid(),
      runningSince: null,
      seconds: 0
    };
    this.data.timers = [timer].concat(this.data.timers);
    this.startTimer(timer.id);
    this.trigger();
  },
  stopTimer: function(id) {
    const timer = this.getTimerById(id);
    if (!timer.runningSince) {
      return;
    }
    timer.seconds += diffSeconds(now(), timer.runningSince);
    timer.runningSince = null;
    this.trigger();
  },
  startTimer: function(id) {
    const timer = this.getTimerById(id);
    this.data.timers.forEach(t => {
      this.stopTimer(t.id);
    });
    this.data.currentTimerId = id;
    timer.runningSince = now();
    this.trigger();
  },
  deleteTimer: function(id) {
    this.data.timers = this.data.timers.filter(function(timer) {
      return timer.id !== id;
    });
    this.trigger();
  },
};

actions.toggleTimerRunning.listen(store.toggleTimerRunning, store);
actions.updateTimerDescription.listen(store.updateTimerDescription, store);
actions.createTimer.listen(store.createTimer, store);
actions.stopTimer.listen(store.stopTimer, store);
actions.startTimer.listen(store.startTimer, store);
actions.deleteTimer.listen(store.deleteTimer, store);

// Components
function onSubmitNewTimerForm(e) {
  e.preventDefault();
  const descriptionField = e.target.querySelector('input');
  actions.createTimer(
    descriptionField.value
  );
  descriptionField.value = '';
}

function NewTimerForm() {
  return (
    <form className="new-timer-form" onSubmit={onSubmitNewTimerForm}>
      <input type="text" />
      <button className="new-timer-button">
        + Timer
      </button>
    </form>
  )
}

function DeleteTimerButton({id}) {
  return (
    <button 
      className="delete-timer-button"
      onClick={() => actions.deleteTimer(id)}
    >
      Delete
    </button>
  )
}

function Timer({onToggle, timer}) {
  const secondsElapsed = timer.runningSince ? diffSeconds(
    now(),
    timer.runningSince
  ) : 0;
  const classes = ['timer'];
  if (timer.runningSince) {
    classes.push('timer--is-running');
  }
  return (
    <div className={classes.join(' ')}>
    <div className="timer__description">
      <input 
        className="timer__description-field"
        type="text" 
        value={timer.description}
        onChange={(e) => actions.updateTimerDescription(timer.id, e.target.value)}
      />
    </div>
      <div className="timer__actions">
      
      <span className="timer__seconds">{formatSeconds(timer.seconds + secondsElapsed)}</span>
        <button 
        className="toggle-timer-button"
        onClick={() => onToggle(timer.id)}>
       {timer.runningSince ? 'Stop' : 'Start'}
      </button>
      <DeleteTimerButton id={timer.id} />
      </div>
    </div>
  )
}

function TimerList({timers}) {
  return (
    <div>
    {timers
      .map(timer => {
        return (
          <Timer
            onToggle={actions.toggleTimerRunning}
            key={timer.id} 
            timer={timer} 
          />
        )
      })}
    </div>
  )
}

function transformStoreToState(store) {
  return {
    timers: store.data.timers
  };
}

class Increment extends React.Component {
  constructor(props) {
    super(props);
    this.state = transformStoreToState(store);
  }
  
  componentDidMount() {
    store.listen(() => {
        this.setState(transformStoreToState(store));      
    });
    setInterval(this.forceUpdate.bind(this), 1000);
  }
  
  render() {
    return (
      <div>
        <NewTimerForm />
        <TimerList timers={this.state.timers} />
      </div>
    )
  }
}


const storageKey = 'increment.data';
const previousData = window.localStorage.getItem(storageKey);
if (previousData) {
 store.data = JSON.parse(previousData);
}
store.listen(function() {
  localStorage.setItem(storageKey, JSON.stringify(store.data));
});

ReactDOM.render(
  <Increment />,
  document.getElementById('app')
);
