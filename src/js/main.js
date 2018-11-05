import {curState} from './state.js';

// hmm, maybe re-write all modules to not depend on document ready,
// but instead have a document ready in this file, and call the other's
// init functions from here?

export var state = curState;
