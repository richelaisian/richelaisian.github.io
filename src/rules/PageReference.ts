import Replace from './Replace';
import { formatAsRanges } from '../utils';
import { Book, Page, pageNumbersForTest } from '../book';

import { shallowEqual, throttleTime } from '../utils';
import { validateRuntimeOptions, RuntimeTypes } from '../runtimeOptionChecker';
import { prefixer } from '../dom';
import { RuleOptions } from './Rule';

// Compatible with ids that start with numbers
const startsWithNumber = (sel: string) => {
  return sel.length > 2 && sel[0] === '#' && /^\d+$/.test(sel[1]);
};
const safeIDSel = (sel: string) => {
  return startsWithNumber(sel) ? `[id="${sel.replace('#', '')}"]` : sel;
};

declare type TestFunction = (el: HTMLElement) => boolean;

interface PageReferenceInstance {
  value: any;
  element: HTMLElement;
  template: HTMLElement;
  test: TestFunction;
}

// Options:
// selector: String
// replace: function (HTMLElement, number) => HTMLElement
class PageReference extends Replace {
  references: PageReferenceInstance[];
  throttledUpdate: (book: Book) => void;

  constructor(options: RuleOptions) {
    super(options);
    validateRuntimeOptions(options, {
      name: 'PageReference',
      selector: RuntimeTypes.string,
      replace: RuntimeTypes.func,
      createTest: RuntimeTypes.func,
    });
    this.references = [];
    const throttle = throttleTime(10);
    this.throttledUpdate = book => {
      throttle(() => this.updatePageReferences(book.pages));
    };
  }

  eachPage(page: Page, book: Book) {
    this.throttledUpdate(book);
  }

  afterAdd(elmt: HTMLElement, book: Book) {
    const test = this.createTest(elmt);
    if (!test) return elmt;

    const ref = this.createReference(book, test, elmt);
    return ref.element;
  }

  createReference(
    book: Book,
    test: TestFunction,
    elmt: HTMLElement,
  ): PageReferenceInstance {
    const ref = {
      test,
      template: elmt,
      element: elmt,
      value: null,
    } as PageReferenceInstance;
    this.references.push(ref);
    const currentResults = pageNumbersForTest(book.pages, test);

    this.render(ref, currentResults); // Replace element immediately, to make sure it'll fit
    return ref;
  }

  render(ref: PageReferenceInstance, newValue: number[]) {
    if (!newValue || shallowEqual(ref.value, newValue)) return;
    if (!Array.isArray(newValue))
      throw Error('Page search returned unexpected result');

    const isResolved = newValue.length > 0;
    const pageRanges = isResolved ? formatAsRanges(newValue) : '⌧';

    const template = ref.template.cloneNode(true) as HTMLElement;
    const newRender = this.replace(template, pageRanges);
    if (!isResolved) newRender.classList.add(prefixer('placeholder-num'));
    ref.element.parentNode!.replaceChild(newRender, ref.element);

    ref.element = newRender;
    ref.value = newValue;
  }

  createTest(element: HTMLElement): TestFunction | null {
    const href = element.getAttribute('href');
    if (!href) return null;
    const selector = safeIDSel(href);
    return (el: HTMLElement) => {
      return !!el.querySelector(selector);
    };
  }

  updatePageReferences(pages: Page[]) {
    // querySelector first, then rerender
    const results = this.references.map(ref => {
      return { ref, data: pageNumbersForTest(pages, ref.test) };
    });

    results.forEach(({ ref, data }) => this.render(ref, data));
  }

  replace(template: HTMLElement, number: string) {
    template.insertAdjacentHTML('beforeend', `, <span>${number}</span>`);
    return template;
  }
}

export default PageReference;
