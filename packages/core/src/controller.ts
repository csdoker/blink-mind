import debug from 'debug';
import memoizeOne from 'memoize-one';
import warning from 'tiny-warning';
import { DocModel, SheetModel } from './models';
import { CorePlugin } from './plugins/core';
import { ModelChangeCallback, OnChangeFunction } from './types';

const log = debug('core:controller');

export interface IControllerOption {
  plugins?: Array<any>;
  docModel?: DocModel;
  readOnly?: boolean;
  onChange?: OnChangeFunction;
}

export interface IControllerRunContext {
  controller: Controller;
  docModel?: DocModel;
  model?: SheetModel;
  topicKey?: KeyType;
  getRef?: Function;
}

export interface IDiagram {
  getDiagramProps(): IDiagramProps;
  openNewDocModel(newModel: DocModel);
}

export interface IDiagramProps {
  docModel: DocModel;
  controller: Controller;
}

function registerPlugin(controller: Controller, plugin: any) {
  if (Array.isArray(plugin)) {
    plugin.forEach(p => registerPlugin(controller, p));
    return;
  }

  if (plugin == null) {
    return;
  }

  for (const key in plugin) {
    const fn = plugin[key];
    controller.middleware[key] = controller.middleware[key] || [];
    controller.middleware[key].push(fn);
  }
}

// modified from koa-compose
function compose(middleware) {
  if (!Array.isArray(middleware))
    throw new TypeError('Middleware stack must be an array!');
  for (const fn of middleware) {
    if (typeof fn !== 'function')
      throw new TypeError('Middleware must be composed of functions!');
  }

  return function(context, next) {
    // last called middleware #
    let index = -1;
    return dispatch(0);
    function dispatch(i) {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      let fn = middleware[i];
      if (i === middleware.length) fn = next;
      if (!fn) return null;
      try {
        return fn(context, dispatch.bind(null, i + 1));
      } catch (err) {
        throw err;
      }
    }
  };
}

export class Controller {
  middleware: Map<string, Function[]>;
  private readonly onChange: OnChangeFunction;
  public readOnly: boolean;
  public docModel: DocModel;

  get model() {
    return this.docModel.currentSheetModel;
  }

  constructor(options: IControllerOption = {}) {
    const { plugins = [], onChange, readOnly } = options;
    this.readOnly = readOnly;
    this.onChange = onChange;
    this.middleware = new Map();
    const corePlugin = CorePlugin({ plugins });
    registerPlugin(this, corePlugin);
  }

  run(key: string, arg?) {
    try {
      const { middleware } = this;
      const fns = middleware[key] || [];
      warning(fns.length !== 0, `the middleware function ${key} is not found!`);
      const composedFn = memoizeOne(compose)(fns);
      // @ts-ignore
      return composedFn(arg);
    } catch (e) {
      this.run('captureError', { error: e });
    }
  }

  getValue(propKey: string, arg?) {
    return this.run('getValue', { ...arg, propKey });
  }

  change(model: DocModel, callback?: ModelChangeCallback) {
    log('change', model, model.currentSheetModel);
    this.docModel = model;
    this.onChange(model, callback);
  }
}
