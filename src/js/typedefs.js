
/**
 * File for all typedefs used by the compiler, and referenced by JSDoc.
 *
 * These look like vars (or var properties), but in fact are simply identifiers
 * for the Closure compiler.  They do not appear in the compiled code.
 */

/**
 * A Point is the point number, as a string, e.g., '580'.
 * @typedef {string}
 *
 */
tf.Point;


/**
 * @typedef {object}
 */
tf.LogEntry;

/**
 * If the log entry represents a rounded point, `point` is the name of
 * the point.
 * @type {string|undefined}
 */
tf.LogEntry.point;
