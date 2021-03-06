import React, { Component, PropTypes } from 'react';
import * as BaseCommands from './commands';
import Bash from './bash';
import Styles from './styles';

const CTRL_CHAR_CODE = 17;
const L_CHAR_CODE = 76;
const C_CHAR_CODE = 67;
const UP_CHAR_CODE = 38;
const DOWN_CHAR_CODE = 40;
const TAB_CHAR_CODE = 9;
const noop = () => {};

export default class Terminal extends Component {

    constructor({ history, structure, extensions, prefix }) {
        super();
        this.Bash = new Bash(extensions);
        this.ctrlPressed = false;
        this.state = {
            settings: { user: { username: prefix.split('@')[1] } },
            history: history.slice(),
            structure: Object.assign({}, structure),
            cwd: '',
            input: {
                value: '',
            },
        };
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleChange = this.handleChange.bind(this);
    }

    componentDidMount() {
        this.refs.input.focus();
        if (this.props.autotyping) {
            this.autoType(this.props.messages);
        }
    }

    componentWillReceiveProps({ extensions, structure, history }) {
        const updatedState = {};
        if (structure) {
            updatedState.structure = Object.assign({}, structure);
        }
        if (history) {
            updatedState.history = history.slice();
        }
        if (extensions) {
            this.Bash.commands = Object.assign({}, extensions, BaseCommands);
        }
        this.setState(updatedState);
    }

    /*
    * Utilize immutability
    */
    shouldComponentUpdate(nextProps, nextState) {
        return (this.state !== nextState) || (this.props !== nextProps);
    }

    /*
    * Keep input in view on change
    */
    componentDidUpdate() {
        this.refs.input.scrollIntoView();
    }

/*
* Autotype messages/commands into terminal's input
*
* Messages are of the form: {
*   text: 'message',
*   speed: 'message speed',
*   timeout: 'time to pause'
* }
*/
    autoType(messages) {
        const message = messages.shift();
        if (!message) {
            return;
        }
        const chars = message.text.split('');
        const intervalId = setInterval(() => {
            const newState = this.state;
            const c = chars.shift();
            if (!c) {
                this.refs.submitButton.click();
                clearInterval(intervalId);
                if (messages) {
                    setTimeout(() => {
                        this.autoType(messages);
                    }, message.timeout || 0);
                    return false;
                } else {
                    return false;
                }
            }
            newState.input.value += c;
            this.setState(newState);
            return false;
        }, message.speed);
    }

    /*
    * Forward the input along to the Bash autocompleter. If it works,
    * update the input.
    */
    attemptAutocomplete() {
        const suggestion = this.Bash.autocomplete(this.state.input.value, this.state);
        if (suggestion) {
            this.refs.input.value = suggestion;
        }
    }

    /*
    * Handle keydown for special hot keys. The tab key
    * has to be handled on key down to prevent default.
    * @param {Event} evt - the DOM event
    */
    handleKeyDown(evt) {
        if (evt.which === CTRL_CHAR_CODE) {
            this.ctrlPressed = true;
        } else if (evt.which === TAB_CHAR_CODE) {
            // Tab must be on keydown to prevent default
            this.attemptAutocomplete();
            evt.preventDefault();
        }
    }

    /*
    * Handle keyup for special hot keys.
    * @param {Event} evt - the DOM event
    *
    * -- Supported hot keys --
    * ctrl + l : clear
    * ctrl + c : cancel current command
    * up - prev command from history
    * down - next command from history
    * tab - autocomplete
    */
    handleKeyUp(evt) {
        if (evt.which === L_CHAR_CODE) {
            if (this.ctrlPressed) {
                this.setState(this.Bash.execute('clear', this.state));
            }
        } else if (evt.which === C_CHAR_CODE) {
            if (this.ctrlPressed) {
                this.refs.input.value = '';
            }
        } else if (evt.which === UP_CHAR_CODE) {
            if (this.Bash.hasPrevCommand()) {
                this.refs.input.value = this.Bash.getPrevCommand();
            }
        } else if (evt.which === DOWN_CHAR_CODE) {
            if (this.Bash.hasNextCommand()) {
                this.refs.input.value = this.Bash.getNextCommand();
            } else {
                this.refs.input.value = '';
            }
        } else if (evt.which === CTRL_CHAR_CODE) {
            this.ctrlPressed = false;
        }
    }

    handleChange(evt) {
        const newState = this.state;
        newState.input.value = evt.target.value;
        this.setState(newState);
    }

    handleSubmit(evt) {
        evt.preventDefault();

        // Execute command
        const input = evt.target[0].value;
        const newState = this.Bash.execute(input, this.state);
        newState.input.value = '';
        this.setState(newState);
    }

    renderHistoryItem(style) {
        return (item, key) => {
            const prefix = item.hasOwnProperty('cwd') ? (
                <span style={style.prefix}>{`${this.props.prefix} ~${item.cwd} $`}</span>
            ) : undefined;
            return <div data-test-id={`history-${key}`} key={key} >{prefix}{item.value}</div>;
        };
    }

    render() {
        const { onClose, onExpand, onMinimize, prefix, theme } = this.props;
        const { history, cwd } = this.state;
        const style = Styles[theme] || Styles.light;
        return (
            <div className="ReactBash" style={style.ReactBash}>
                <div style={style.header}>
                    <span style={style.redCircle} onClick={onClose}></span>
                    <span style={style.yellowCircle} onClick={onMinimize}></span>
                    <span style={style.greenCircle} onClick={onExpand}></span>
                </div>
                <div style={style.body} onClick={() => this.refs.input.focus()}>
                    {history.map(this.renderHistoryItem(style))}
                    <form ref="rbterminal" onSubmit={evt => this.handleSubmit(evt)} style={style.form}>
                        <span style={style.prefix}>{`${prefix} ~${cwd} $`}</span>
                        <input
                          autoComplete="off"
                          onKeyDown={this.handleKeyDown}
                          onKeyUp={this.handleKeyUp}
                          ref="input"
                          style={style.input}
                          value={this.state.input.value}
                          onChange={this.handleChange}
                        />
                        <button style={{ display: 'none' }} ref="submitButton" type="submit"></button>
                    </form>
                </div>
            </div>
        );
    }
}

Terminal.Themes = {
    LIGHT: 'light',
    DARK: 'dark',
};

Terminal.propTypes = {
    extensions: PropTypes.object,
    history: PropTypes.array,
    messages: PropTypes.array,
    autotyping: PropTypes.bool,
    onClose: PropTypes.func,
    onExpand: PropTypes.func,
    onMinimize: PropTypes.func,
    prefix: PropTypes.string,
    structure: PropTypes.object,
    theme: PropTypes.string,
};

Terminal.defaultProps = {
    extensions: {},
    history: [],
    onClose: noop,
    onExpand: noop,
    onMinimize: noop,
    prefix: 'hacker@default',
    structure: {},
    theme: Terminal.Themes.LIGHT,
};
