/**
 * DiffBeacon core design reminder: one deterministic API serves Node and the
 * browser, with no network, filesystem, Git, React, or terminal dependency.
 */

export * from './analyze.js';
export * from './detectors/registry.js';
export * from './model.js';
export * from './parser.js';
export * from './render.js';
