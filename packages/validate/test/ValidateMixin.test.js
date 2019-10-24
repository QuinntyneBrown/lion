/* eslint-disable no-unused-vars, no-param-reassign */
import { expect, fixture, html, unsafeStatic, defineCE, aTimeout } from '@open-wc/testing';
import sinon from 'sinon';
import { LitElement } from '@lion/core';
import { ValidateMixin } from '../src/ValidateMixin.js';
import { Unparseable } from '../src/Unparseable.js';
import { Validator } from '../src/Validator.js';
import { ResultValidator } from '../src/ResultValidator.js';
import { Required } from '../src/validators/Required.js';
import { MinLength, MaxLength } from '../src/validators/StringValidators.js';
import { DefaultSuccess } from '../src/resultValidators/DefaultSuccess.js';
import { AlwaysValid, AlwaysInvalid } from '../test-helpers/helper-validators.js';
import { LionValidationFeedback } from '../src/LionValidationFeedback.js';

// element, lightDom, errorShowPrerequisite, warningShowPrerequisite, infoShowPrerequisite,
// successShowPrerequisite

const externalVariables = {};
const lightDom = '';

const tagString = defineCE(
  class extends ValidateMixin(LitElement) {
    static get properties() {
      return { modelValue: String };
    }
  },
);
const tag = unsafeStatic(tagString);

describe.only('ValidateMixin', () => {
  /**
   *   Terminology
   *
   * - *validatable-field*
   *   The element ('this') the ValidateMixin is applied on.
   *
   * - *input-node*
   *   The 'this._inputNode' property (usually a getter) that returns/contains a reference to an
   *   interaction element that receives focus, displays the input value, interaction states are
   *   derived from, aria properties are put on and setCustomValidity (if applicable) is called on.
   *   Can be input, textarea, my-custom-slider etc.
   *
   * - *feedback-node*
   *   The 'this._feedbackNode' property (usually a getter) that returns/contains a reference to
   *   the output container for validation feedback. Messages will be written to this element
   *   based on user defined or default validity feedback visibility conditions.
   *
   * - *show-{type}-feedback-condition*
   *   The 'this.hasErrorVisible value that stores whether the
   *   feedback for the particular validation type should be shown to the end user.
   */

  describe('Validation initiation', () => {
    it('validates on initialization (once form field has bootstrapped/initialized)', async () => {
      const el = await fixture(html`
        <${tag}
          .validators=${[new Required()]}
        >${lightDom}</${tag}>
      `);
      expect(el.hasError).to.be.true;
    });

    it('revalidates when ".modelValue" changes', async () => {
      const el = await fixture(html`
        <${tag}
          .validators=${[new AlwaysValid()]}
          .modelValue=${'myValue'}
        >${lightDom}</${tag}>
      `);

      const validateSpy = sinon.spy(el, 'validate');
      el.modelValue = 'x';
      expect(validateSpy.callCount).to.equal(1);
    });

    it('revalidates when ".validators" changes', async () => {
      const el = await fixture(html`
        <${tag}
          .validators=${[new AlwaysValid()]}
          .modelValue=${'myValue'}
        >${lightDom}</${tag}>
      `);

      const validateSpy = sinon.spy(el, 'validate');
      el.validators = [new MinLength(3)];
      expect(validateSpy.callCount).to.equal(1);
    });

    it('clears current results when ".modelValue" changes', async () => {
      const el = await fixture(html`
        <${tag}
          .validators=${[new AlwaysValid()]}
          .modelValue=${'myValue'}
        >${lightDom}</${tag}>
      `);

      const clearSpy = sinon.spy(el, '__clearValidationResults');
      const validateSpy = sinon.spy(el, 'validate');
      el.modelValue = 'x';
      expect(clearSpy.callCount).to.equal(1);
      expect(validateSpy.args[0][0]).to.eql({
        clearCurrentResult: true,
      });
    });

    /**
     * Inside "Validator integration" we test reinitiation on Validator param change
     */
  });

  describe('Validation internal flow', () => {
    it('firstly checks for empty values', async () => {
      const alwaysValid = new AlwaysValid();
      const alwaysValidExecuteSpy = sinon.spy(alwaysValid, 'execute');
      const el = await fixture(html`
        <${tag} .validators=${[alwaysValid]}>${lightDom}</${tag}>
      `);
      const isEmptySpy = sinon.spy(el, '__isEmpty');
      const validateSpy = sinon.spy(el, 'validate');
      el.modelValue = '';
      expect(validateSpy.callCount).to.equal(1);
      expect(alwaysValidExecuteSpy.callCount).to.equal(0);
      expect(isEmptySpy.callCount).to.equal(1);

      // el.modelValue = 'nonEmpty';
      // expect(validateSpy.callCount).to.equal(2);
      // expect(alwaysValidExecuteSpy.callCount).to.equal(1);
      // expect(isEmptySpy.callCount).to.equal(2);
    });

    it('secondly checks for synchronous Validators: creates RegularValidationResult', async () => {
      const el = await fixture(html`
        <${tag} .validators=${[new AlwaysValid()]}>${lightDom}</${tag}>
      `);
      const isEmptySpy = sinon.spy(el, '__isEmpty');
      const syncSpy = sinon.spy(el, '__executeSyncValidators');
      el.modelValue = 'nonEmpty';
      expect(isEmptySpy.calledBefore(syncSpy)).to.be.true;
    });

    it('thirdly schedules asynchronous Validators: creates RegularValidationResult', async () => {
      const el = await fixture(html`
        <${tag} .validators=${[new AlwaysValid(), new AlwaysValid(null, { async: true })]}>
          ${lightDom}
        </${tag}>
      `);
      const syncSpy = sinon.spy(el, '__executeSyncValidators');
      const asyncSpy = sinon.spy(el, '__executeAsyncValidators');
      el.modelValue = 'nonEmpty';
      expect(syncSpy.calledBefore(asyncSpy)).to.be.true;
    });

    it('finally checks for ResultValidators: creates TotalValidationResult', async () => {
      class MyResult extends ResultValidator {
        constructor(...args) {
          super(...args);
          this.name = 'ResultValidator';
        }
      }

      class AsyncAlwaysValid extends AlwaysValid {
        constructor(...args) {
          super(...args);
          this.async = true;
        }
      }

      const el = await fixture(html`
        <${tag}
          .validators=${[new AsyncAlwaysValid(), new MyResult()]}>
          ${lightDom}
        </${tag}>
      `);

      const asyncSpy = sinon.spy(el, '__executeAsyncValidators');
      const resultSpy = sinon.spy(el, '__executeResultValidators');
      console.log('trigger');
      el.modelValue = 'nonEmpty';
      expect(asyncSpy.calledBefore(resultSpy)).to.be.true;

      const el2 = await fixture(html`
        <${tag}
          .validators=${[new AlwaysValid(), new MyResult()]}>
          ${lightDom}
        </${tag}>
      `);

      const syncSpy = sinon.spy(el2, '__executeSyncValidators');
      const resultSpy2 = sinon.spy(el2, '__executeResultValidators');

      el2.modelValue = 'nonEmpty';
      expect(syncSpy.calledBefore(resultSpy2)).to.be.true;
    });

    describe('Finalization', () => {
      it('fires "validation-done" event', async () => {});

      it('renders feedback', async () => {});
    });
  });

  describe('Validator Integration', () => {
    class IsCat extends Validator {
      constructor(...args) {
        super(...args);
        this.name = 'isCat';
        this.execute = (modelValue, param) => {
          const validateString = param && param.number ? `cat${param.number}` : 'cat';
          const showError = modelValue !== validateString;
          return showError;
        };
      }
    }

    class OtherValidator extends Validator {
      constructor(...args) {
        super(...args);
        this.name = 'otherValidator';
        this.execute = () => true;
      }
    }

    it('Validators will be called with ".modelValue" as first argument', async () => {
      const otherValidator = new OtherValidator();
      const otherValidatorSpy = sinon.spy(otherValidator, 'execute');
      await fixture(html`
        <${tag}
          .validators=${[new Required(), otherValidator]}
          .modelValue=${'model'}
        >${lightDom}</${tag}>
      `);
      expect(otherValidatorSpy.calledWith('model')).to.be.true;
    });

    it('Validators will be called with viewValue as first argument when modelValue is unparseable', async () => {
      const otherValidator = new OtherValidator();
      const otherValidatorSpy = sinon.spy(otherValidator, 'execute');
      await fixture(html`
        <${tag}
          .validators=${[new Required(), otherValidator]}
          .modelValue=${new Unparseable('view')}
        >${lightDom}</${tag}>
      `);
      expect(otherValidatorSpy.calledWith('view')).to.be.true;
    });

    it('Validators will be called with param as a second argument', async () => {
      const param = { number: 5 };
      const validator = new IsCat(param);
      const executeSpy = sinon.spy(validator, 'execute');
      const el = await fixture(html`
        <${tag}
          .validators=${[validator]}
          .modelValue=${'cat'}
        >${lightDom}</${tag}>
      `);
      expect(executeSpy.args[0][1]).to.equal(param);
    });

    it('Validators will not be called on empty values', async () => {
      const el = await fixture(html`
        <${tag} .validators=${[new IsCat()]}>${lightDom}</${tag}>
      `);

      el.modelValue = 'cat';
      expect(el.errorStates.isCat).to.be.undefined;
      el.modelValue = 'dog';
      expect(el.errorStates.isCat).to.be.true;
      el.modelValue = '';
      expect(el.errorStates.isCat).to.be.undefined;
    });

    it('Validators get retriggered on parameter change', async () => {
      const isCatValidator = new IsCat('Felix');
      const catSpy = sinon.spy(isCatValidator, 'execute');
      const el = await fixture(html`
        <${tag}
          .validators=${[isCatValidator]}
          .modelValue=${'cat'}
        >${lightDom}</${tag}>
      `);
      el.modelValue = 'cat';
      expect(catSpy.callCount).to.equal(1);
      // isCatValidator.param = 'Garfield';
      // expect(catSpy.callCount).to.equal(2);
    });

    // it(`replaces native validators (required, minlength, maxlength, min, max, pattern, step,
    //     type(email/date/number/...) etc.) [to-be-investigated]`, async () => {
    //   // TODO: this could also become: "can be used in conjunction with"

    // });
  });

  describe('Async Validator Integration', () => {
    let asyncVPromise;
    let asyncVResolve;

    beforeEach(() => {
      asyncVPromise = new Promise(resolve => {
        asyncVResolve = resolve;
      });
    });

    class IsAsyncCat extends Validator {
      constructor(param, config) {
        super(param, config);
        this.name = 'delayed-cat';
        this.async = true;
      }

      /**
       * @desc the function that determines the validator. It returns true when
       * the Validator is "active", meaning its message should be shown.
       * @param {string} modelValue
       */
      async execute(modelValue) {
        await asyncVPromise;
        const hasError = modelValue !== 'cat';
        return hasError;
      }
    }

    // default execution trigger is keyup (think of password availability backend)
    // can configure execution trigger (blur, etc?)
    it('handles "execute" functions returning promises', async () => {
      const el = await fixture(html`
        <${tag}
          .modelValue=${'dog'}
          .validators=${[new IsAsyncCat()]}>
        ${lightDom}
        </${tag}>
      `);

      const validator = el.validators[0];
      expect(validator instanceof Validator).to.be.true;
      expect(el.hasError).to.be.undefined;
      asyncVResolve();
      await aTimeout();
      expect(el.hasError).to.be.true;
    });

    it('sets ".isPending/[is-pending]" when validation is in progress', async () => {
      const el = await fixture(html`
        <${tag} .modelValue=${'dog'}>${lightDom}</${tag}>
      `);
      expect(el.isPending).to.be.false;
      expect(el.hasAttribute('is-pending')).to.be.false;

      el.validators = [new IsAsyncCat()];
      expect(el.isPending).to.be.true;
      await aTimeout();
      expect(el.hasAttribute('is-pending')).to.be.true;

      asyncVResolve();
      await aTimeout();
      expect(el.isPending).to.be.false;
      expect(el.hasAttribute('is-pending')).to.be.false;
    });

    // TODO: 'mock' these methods without actually waiting for debounce?
    it.skip('debounces async validation for performance', async () => {
      const asyncV = new IsAsyncCat();
      const asyncVExecuteSpy = sinon.spy(asyncV, 'execute');

      const el = await fixture(html`
        <${tag} .modelValue=${'dog'}>
          ${lightDom}
        </${tag}>
      `);
      // debounce started
      el.validators = [asyncV];
      expect(asyncVExecuteSpy.called).to.equal(0);
      // TODO: consider wrapping debounce in instance/ctor function to make spying possible
      // await debounceFinish
      expect(asyncVExecuteSpy.called).to.equal(1);

      // New validation cycle. Now change modelValue inbetween, so validation is retriggered.
      asyncVExecuteSpy.reset();
      el.modelValue = 'dogger';
      expect(asyncVExecuteSpy.called).to.equal(0);
      el.modelValue = 'doggerer';
      // await original debounce period...
      expect(asyncVExecuteSpy.called).to.equal(0);
      // await original debounce again without changing mv inbetween...
      expect(asyncVExecuteSpy.called).to.equal(1);
    });

    // TODO: nice to have...
    it.skip('developer can configure debounce on FormControl instance', async () => {});

    it.skip('cancels and reschedules async validation on ".modelValue" change', async () => {
      const asyncV = new IsAsyncCat();
      const asyncVAbortSpy = sinon.spy(asyncV, 'abort');

      const el = await fixture(html`
        <${tag} .modelValue=${'dog'}>
          ${lightDom}
        </${tag}>
      `);
      // debounce started
      el.validators = [asyncV];
      expect(asyncVAbortSpy.called).to.equal(0);
      el.modelValue = 'dogger';
      // await original debounce period...
      expect(asyncVAbortSpy.called).to.equal(1);
    });

    // TODO: nice to have
    it.skip('developer can configure condition for asynchronous validation', async () => {
      const asyncV = new IsAsyncCat();
      const asyncVExecuteSpy = sinon.spy(asyncV, 'execute');

      const el = await fixture(html`
        <${tag}
          .isFocused=${true}
          .modelValue=${'dog'}
          .validators=${[asyncV]}
          .asyncValidateOn=${({ formControl }) => !formControl.isFocused}
          >
        ${lightDom}
        </${tag}>
      `);

      expect(asyncVExecuteSpy.called).to.equal(0);
      el.isFocused = false;
      el.validate();
      expect(asyncVExecuteSpy.called).to.equal(1);
    });
  });

  describe('ResultValidator Integration', () => {
    class MySuccessResultValidator extends ResultValidator {
      constructor(...args) {
        super(...args);
        this.type = 'success';
      }

      // eslint-disable-next-line class-methods-use-this
      executeOnResults({ regularValidationResult, prevValidationResult }) {
        const errorOrWarning = v => v.type === 'error' || v.type === 'warning';
        const hasErrorOrWarning = !!regularValidationResult.filter(errorOrWarning).length;
        const prevHadErrorOrWarning = !!prevValidationResult.filter(errorOrWarning).length;
        return !hasErrorOrWarning && prevHadErrorOrWarning;
      }
    }

    // TODO: ".calledBefore" is pseudo code... mplement in other way
    it('calls ResultValidators after regular validators', async () => {
      const resultValidator = new MySuccessResultValidator();
      const resultValidateSpy = sinon.spy(resultValidator, 'executeOnResults');

      // After regular sync Validators
      const validator = new MinLength(3);
      const validateSpy = sinon.spy(validator, 'execute');
      await fixture(html`
        <${tag}
          .validators=${[resultValidator, validator]}
          .modelValue=${'myValue'}
        >${lightDom}</${tag}>
      `);
      expect(validateSpy.calledBefore(resultValidateSpy)).to.be.true;

      // Also after regular async Validators
      const validatorAsync = new MinLength(3, { async: true });
      const validateAsyncSpy = sinon.spy(validatorAsync, 'execute');
      await fixture(html`
      <${tag}
        .validators=${[resultValidator, validatorAsync]}
        .modelValue=${'myValue'}
      >${lightDom}</${tag}>
    `);
      expect(validateAsyncSpy.calledBefore(resultValidateSpy)).to.be.true;
    });

    it(`provides "regular" ValidationResult and previous FinalValidationResult as input to
      "executeOnResults" function`, async () => {
      const resultValidator = new MySuccessResultValidator();
      const resultValidateSpy = sinon.spy(resultValidator, 'executeOnResults');

      const el = await fixture(html`
          <${tag}
            .validators=${[new MinLength(3), resultValidator]}
            .modelValue=${'myValue'}
          >${lightDom}</${tag}>
        `);
      const prevValidationResult = el.__prevValidationResult;
      const regularValidationResult = [...el.__syncValidationResult, ...el.__asyncValidationResult];

      expect(resultValidateSpy.args[0][0]).to.eql({
        prevValidationResult,
        regularValidationResult,
      });
    });

    it('adds ResultValidator outcome as highest prio result to the FinalValidationResult', async () => {
      class AlwaysInvalidResult extends ResultValidator {
        // eslint-disable-next-line class-methods-use-this
        executeOnResults() {
          const hasError = true;
          return hasError;
        }
      }

      const validator = new AlwaysInvalid();
      const resultV = new AlwaysInvalidResult();

      const el = await fixture(html`
        <${tag}
          .validators=${[validator, resultV]}
          .modelValue=${'myValue'}
        >${lightDom}</${tag}>
      `);

      const /** @type {TotalValidationResult} */ totalValidationResult = el.__validationResult;
      expect(totalValidationResult).to.eql([resultV, validator]);
    });
  });

  describe('Required Validator integration', () => {
    it('will result in erroneous state when form control is empty', async () => {
      const el = await fixture(html`
        <${tag}
          .validators=${[new Required()]}
          .modelValue=${''}
        >${lightDom}</${tag}>
      `);
      expect(el.errorStates.Required).to.be.true;
      expect(el.hasError).to.be.true;
      el.modelValue = 'foo';
      expect(el.errorStates.Required).to.be.undefined;
      // expect(el.hasError).to.be.false;
    });

    // TODO: should we combine this with ._isPrefilled...?
    it('calls private ".__isEmpty" by default', async () => {
      const el = await fixture(html`
        <${tag}
          .validators=${[new Required()]}
          .modelValue=${''}
        >${lightDom}</${tag}>
      `);
      const validator = el.validators.find(v => v instanceof Required);
      const executeSpy = sinon.spy(validator, 'execute');
      const privateIsEmptySpy = sinon.spy(el, '__isEmpty');
      el.modelValue = null;
      expect(executeSpy.callCount).to.equal(0);
      expect(privateIsEmptySpy.callCount).to.equal(1);
    });

    it('calls "._isEmpty" when provided (useful for different modelValues)', async () => {
      const customRequiredTagString = defineCE(
        class extends ValidateMixin(LitElement) {
          _isEmpty(modelValue) {
            return modelValue.model === '';
          }
        },
      );
      const customRequiredTag = unsafeStatic(customRequiredTagString);

      const el = await fixture(html`
        <${customRequiredTag}
          .validators=${[new Required()]}
          .modelValue=${{ model: 'foo' }}
        >${lightDom}</${customRequiredTag}>
      `);

      const providedIsEmptySpy = sinon.spy(el, '_isEmpty');
      el.modelValue = { model: '' };
      expect(providedIsEmptySpy.callCount).to.equal(1);
      expect(el.errorStates.Required).to.be.true;
    });

    it('prevents other Validators from being called when input is empty', async () => {
      const alwaysInvalid = new AlwaysInvalid();
      const alwaysInvalidSpy = sinon.spy(alwaysInvalid, 'execute');
      const el = await fixture(html`
        <${tag}
          .validators=${[new Required(), alwaysInvalid]}
          .modelValue=${''}
        >${lightDom}</${tag}>
      `);
      expect(alwaysInvalidSpy.callCount).to.equal(0); // __isRequired returned false (invalid)
      el.modelValue = 'foo';
      expect(alwaysInvalidSpy.callCount).to.equal(1); // __isRequired returned true (valid)
    });

    it('adds [aria-required="true"] to "._inputNode"', async () => {
      const withInputTagString = defineCE(
        class extends ValidateMixin(LitElement) {
          connectedCallback() {
            super.connectedCallback();
            this.appendChild(document.createElement('input'));
          }

          get _inputNode() {
            return this.querySelector('input');
          }
        },
      );
      const withInputTag = unsafeStatic(withInputTagString);

      const el = await fixture(html`
        <${withInputTag}
          .validators=${[new Required()]}
          .modelValue=${''}
        >${lightDom}</${withInputTag}>
      `);
      expect(el._inputNode.getAttribute('aria-required')).to.equal('true');
      el.validators = [];
      expect(el._inputNode.getAttribute('aria-required')).to.be.null;
    });
  });

  describe('Default (preconfigured) Validators', () => {
    const preconfTagString = defineCE(
      class extends ValidateMixin(LitElement) {
        constructor() {
          super();
          this.defaultValidators = [new AlwaysInvalid()];
        }
      },
    );
    const preconfTag = unsafeStatic(preconfTagString);

    it('can be stored for custom inputs', async () => {
      const el = await fixture(html`
      <${preconfTag}
        .validators=${[new MinLength(3)]}
        .modelValue=${'12'}
      ></${preconfTag}>`);

      expect(el.errorStates.AlwaysInvalid).to.be.true;
      expect(el.errorStates.MinLength).to.be.true;
    });

    it('can be altered by App Developers', async () => {
        const altPreconfTagString = defineCE(
          class extends ValidateMixin(LitElement) {
            constructor() {
              super();
              this.defaultValidators = [new MinLength(3)];
            }
          },
        );
        const altPreconfTag = unsafeStatic(altPreconfTagString);

        const el = await fixture(html`
        <${altPreconfTag}
          .modelValue=${'12'}
        ></${altPreconfTag}>`);

        expect(el.errorStates.MinLength).to.be.true;
        el.defaultValidators[0].param = 2;
        expect(el.errorStates.MinLength).to.be.undefined;
    });

    it('can be requested via "._allValidators" getter', async () => {
      const el = await fixture(html`
      <${preconfTag}
        .validators=${[new MinLength(3)]}
      ></${preconfTag}>`);

      expect(el.validators.length).to.equal(1);
      expect(el.defaultValidators.length).to.equal(1);
      expect(el._allValidators.length).to.equal(2);

      expect(el._allValidators[0] instanceof MinLength).to.be.true;
      expect(el._allValidators[1] instanceof AlwaysInvalid).to.be.true;

      el.validators = [new MaxLength(5)];
      expect(el._allValidators[0] instanceof MaxLength).to.be.true;
      expect(el._allValidators[1] instanceof AlwaysInvalid).to.be.true;
    });
  });

  describe.skip('State storage and reflection', () => {
    class ContainsLowercaseA extends Validator {
      constructor(...args) {
        super(...args);
        this.name = 'containsLowercaseA';
        this.execute = modelValue => !modelValue.includes('a');
      }
    }

    class ContainsLowercaseB extends Validator {
      constructor(...args) {
        super(...args);
        this.name = 'containsLowercaseB';
        this.execute = modelValue => !modelValue.includes('b');
      }
    }

    it('stores active state in ".hasError"/[has-error] flag', async () => {
      const el = await fixture(html`
        <${tag}
          .validators=${[new MinLength(3)]}
        >${lightDom}</${tag}>
      `);

      el.modelValue = 'a';

      expect(el.hasError).to.be.true;
      expect(el.hasAttribute('has-error')).to.be.true;

      el.modelValue = 'abc';
      expect(el.hasError).to.be.false;
      expect(el.hasAttribute('has-error')).to.be.false;

      el.modelValue = 'abcde';
      expect(el.hasError).to.be.false;
      expect(el.hasAttribute('has-error')).to.be.false;

      el.modelValue = 'abcdefg';
      expect(el.hasError).to.be.false;
      expect(el.hasAttribute('has-error')).to.be.false;
    });

    it('sets ".hasErrorVisible"/[has-error-visible] when visibility condition is met', async () => {
      const el = await fixture(html`
        <${tag} .validators=${[new MinLength(3)]}>${lightDom}</${tag}>`);

      if (externalVariables.hasErrorVisiblePrerequisite) {
        externalVariables.hasErrorVisiblePrerequisite(el);
      }

      el.modelValue = 'a';
      await el.updateComplete;

      expect(el.hasErrorVisible).to.be.true;
      await el.updateComplete;
      expect(el.hasAttribute('has-error-visible')).to.be.true;

      el.modelValue = 'abc';
      expect(el.hasErrorVisible).to.be.false;
      await el.updateComplete;
      expect(el.hasAttribute('has-error-visible')).to.be.false;
    });

    it('stores validity of individual Validators in ".errorStates[validator.name]"', async () => {
      const el = await fixture(html`
        <${tag}
          .modelValue=${'a'}
          .validators=${[new MinLength(3), new AlwaysInvalid()]}
        >${lightDom}</${tag}>`);

      expect(el.errorStates.minLength).to.be.true;
      expect(el.errorStates.alwaysInvalid).to.be.true;

      el.modelValue = 'abc';

      expect(el.errorStates.minLength).to.equal(undefined);
      expect(el.errorStates.alwaysInvalid).to.be.true;
    });

    it('removes "non active" states whenever modelValue becomes undefined', async () => {
      const el = await fixture(html`
        <${tag}
          .validators=${[new MinLength(3)]}
        >${lightDom}</${tag}>
      `);

      el.modelValue = 'a';
      expect(el.hasError).to.be.true;

      expect(el.errorStates).to.not.eql({});

      el.modelValue = undefined;
      expect(el.hasError).to.be.false;
      expect(el.errorStates).to.eql({});
    });

    describe('Events', () => {
      it('fires "has-error-changed" event when state changes', async () => {
        const el = await fixture(html`
          <${tag}
            .validators=${[new MinLength(7)]}
          >${lightDom}</${tag}>
        `);
        const cbError = sinon.spy();
        el.addEventListener('has-error-changed', cbError);

        el.modelValue = 'a';
        expect(cbError.callCount).to.equal(1);

        el.modelValue = 'abc';
        expect(cbError.callCount).to.equal(1);

        el.modelValue = 'abcde';
        expect(cbError.callCount).to.equal(1);

        el.modelValue = 'abcdefg';
        expect(cbError.callCount).to.equal(2);
      });

      it('fires "error-states-changed" event when "internal" state changes', async () => {
        const el = await fixture(html`
          <${tag}
            .validators=${[new MinLength(3), new ContainsLowercaseA(), new ContainsLowercaseB()]}
          >${lightDom}
          </${tag}>
        `);

        const cbError = sinon.spy();
        el.addEventListener('error-states-changed', cbError);

        el.modelValue = 'a';
        expect(cbError.callCount).to.equal(1);

        el.modelValue = 'aa';
        expect(cbError.callCount).to.equal(1);

        el.modelValue = 'aaa';
        expect(cbError.callCount).to.equal(2);

        el.modelValue = 'aba';
        expect(cbError.callCount).to.equal(3);
      });
    });
  });

  describe.skip('Accessibility', () => {
    it('sets [aria-invalid="true"] to "._inputNode" when ".hasError" is true', async () => {
      const el = await fixture(html`<${tag}>${lightDom}</${tag}>`);

      el.hasError = true;
      expect(el.hasAttribute('aria-invalid')).to.be.false;
      el.hasErrorVisible = true;
      expect(el.hasAttribute('aria-invalid')).to.be.true;
      el.hasErrorVisible = false;
      expect(el.hasAttribute('aria-invalid')).to.be.false;
    });

    it.skip('calls "._inputNode.setCustomValidity(errorMessage)"', async () => {
      const el = await fixture(html`
        <${tag}
          .modelValue=${'123'}
          .validators=${[new MinLength(3, { message: 'foo' })]}>
          <input slot="input">
        </${tag}>`);
      const spy = sinon.spy(el.inputElement, 'setCustomValidity');
      el.modelValue = '';
      expect(spy.callCount).to.be(1);
      expect(el.validationMessage).to.be('foo');
      el.modelValue = '123';
      expect(spy.callCount).to.be(2);
      expect(el.validationMessage).to.be('');
    });

    // TODO: check with open a11y issues and find best solution here
    it.skip(`removes validity message from DOM instead of toggling "display:none", to trigger Jaws
        and VoiceOver [to-be-implemented]`, async () => {});
  });

  describe.skip('Extensibility: Custom Validator types', () => {
    const customTypeTagString = defineCE(
      class extends ValidateMixin(LitElement) {
        static get validationTypes() {
          return [...super.validationTypes, 'type1', 'type2'];
        }
      },
    );
    const customTypeTag = unsafeStatic(customTypeTagString);

    it('supports multiple "has{Type}" flags', async () => {
      const el = await fixture(html`
        <${customTypeTag}
          .validators=${[
            new MinLength(1, { type: 'type1' }),
            new MinLength(2, { type: 'error' }),
            new MinLength(3, { type: 'type2' }),
          ]}
          .modelValue=${'123'}
        >${lightDom}</${customTypeTag}>
      `);
      expect(el.hasType2).to.be.false;
      expect(el.hasError).to.be.false;
      expect(el.hasType1).to.be.false;

      el.modelValue = '12'; // triggers rype1
      expect(el.hasType2).to.be.true;
      expect(el.hasError).to.be.false;
      expect(el.hasType1).to.be.false;

      el.modelValue = '1'; // triggers error
      expect(el.hasType2).to.be.true;
      expect(el.hasError).to.be.true;
      expect(el.hasType1).to.be.false;

      el.modelValue = ''; // triggers error
      expect(el.hasType2).to.be.true;
      expect(el.hasError).to.be.true;
      expect(el.hasType1).to.be.true;
    });

    it('supports multiple "{type}States" objects', async () => {
      const el = await fixture(html`
        <${customTypeTag}
          .validators=${[
            new MinLength(1, { type: 'type1' }),
            new MinLength(2, { type: 'error' }),
            new MinLength(3, { type: 'type2' }),
          ]}
          .modelValue=${'123'}
        >${lightDom}</${customTypeTag}>
      `);
      expect(el.type2States).to.eql({});
      expect(el.errorStates).to.eql({});
      expect(el.type1States).to.eql({});

      el.modelValue = '12'; // triggers type1
      expect(el.type2States).to.eql({ minLength: true });
      expect(el.errorStates).to.eql({});
      expect(el.type1States).to.eql({});

      el.modelValue = '1'; // triggers error
      expect(el.type2States).to.eql({ minLength: true });
      expect(el.errorStates).to.eql({ minLength: true });
      expect(el.type1States).to.eql({});

      el.modelValue = ''; // triggers type2
      expect(el.type2States).to.eql({ minLength: true });
      expect(el.errorStates).to.eql({ minLength: true });
      expect(el.type1States).to.eql({ minLength: true });
    });

    it('supports multiple "has{Type}Visible" flags', async () => {
      const el = await fixture(html`
        <${customTypeTag}
          .validators=${[
            new MinLength(1, { type: 'type1' }),
            new MinLength(2, { type: 'error' }),
            new MinLength(3, { type: 'type2' }),
          ]}
          .modelValue=${'123'}
        >${lightDom}</${customTypeTag}>
      `);
      expect(el.hasType2Visible).to.be.false;
      expect(el.hasErrorVisible).to.be.false;
      expect(el.hasType1Visible).to.be.false;

      el.modelValue = ''; // triggers type2
      expect(el.hasType2Visible).to.be.true;
      expect(el.hasErrorVisible).to.be.true;
      expect(el.hasType1Visible).to.be.true;
    });

    it('orders feedback based on provided "validationTypes"', async () => {
      const type1MinLength = new MinLength(1, { type: 'type1' });
      const errorMinLength = new MinLength(2, { type: 'error' });
      const type2MinLength = new MinLength(3, { type: 'type2' });

      const el = await fixture(html`
        <${customTypeTag}
          .validators=${[type1MinLength, errorMinLength, type2MinLength]}
          .modelValue=${''}
        >${lightDom}</${customTypeTag}>
      `);
      const prioSpy = sinon.spy(el, '_prioritizeAndFilterFeedback');
      expect(prioSpy.callCount).to.equal(1);
      const configuredTypes = el.constructor.validationTypes; // => ['error', 'type1', 'type2'];
      const orderedResulTypes = el.__prioritizedResult.map(v => v.type);
      expect(orderedResulTypes).to.eql(configuredTypes);

      el.modelValue = '1';
      const orderedResulTypes2 = el.__prioritizedResult.map(v => v.type);
      expect(orderedResulTypes2).to.eql(['error', 'type2']);
    });

    it('sends out events for custom types', async () => {
      const type1MinLength = new MinLength(1, { type: 'type1' });
      const type2MinLength = new MinLength(2, { type: 'type2' });

      const el = await fixture(html`
      <${customTypeTag}
        .validators=${[type1MinLength, type2MinLength]}
        .modelValue=${'123'}
      >${lightDom}</${customTypeTag}>
    `);
      const type1ChangedSpy = sinon.spy();
      const hasType1ChangedSpy = sinon.spy();
      el.addEventListener('type1-changed', type1ChangedSpy);
      el.addEventListener('has-type1-changed', hasType1ChangedSpy);

      const type2ChangedSpy = sinon.spy();
      const hasType2ChangedSpy = sinon.spy();
      el.addEventListener('type2-changed', type2ChangedSpy);
      el.addEventListener('has-type2-changed', hasType2ChangedSpy);

      el.modelValue = '';
      expect(type1ChangedSpy.callCount).to.equal(1);
      expect(hasType1ChangedSpy.callCount).to.equal(1);
      expect(type2ChangedSpy.callCount).to.equal(1);
      expect(hasType2ChangedSpy.callCount).to.equal(1);

      const type2AlwaysInvalid = new AlwaysInvalid(null, { type: 'type2' });
      el.validators = [...el.validators, type2AlwaysInvalid];

      expect(type1ChangedSpy.callCount).to.equal(1);
      expect(hasType1ChangedSpy.callCount).to.equal(1);
      expect(type2ChangedSpy.callCount).to.equal(2); // Change within type 2, since it went from 1 validator to two
      expect(hasType2ChangedSpy.callCount).to.equal(1);
    });

    /**
     * Out of scope:
     * - automatic reflection of attrs
     */
  });

  describe.skip('Validity Feedback', () => {
    class ContainsLowercaseA extends Validator {
      constructor(...args) {
        super(...args);
        this.name = 'containsLowercaseA';
        this.execute = modelValue => !modelValue.includes('a');
      }
    }

    class ContainsCat extends Validator {
      constructor(...args) {
        super(...args);
        this.name = 'containsCat';
        this.execute = modelValue => !modelValue.includes('cat');
      }
    }

    AlwaysInvalid.getMessage = () => 'Message for alwaysInvalid';
    MinLength.getMessage = () => 'Message for minLength';
    ContainsLowercaseA.getMessage = () => 'Message for containsLowercaseA';
    ContainsCat.getMessage = () => 'Message for containsCat';

    it('has configurable feedback visibility hook', async () => {
      const el = await fixture(html`
        <${tag}
          ._prioritizeAndFilterFeedback=${() => []}
          .modelValue=${'cat'}
          .validators=${[new AlwaysInvalid()]}
        >${lightDom}</${tag}>
      `);
      expect(el._feedbackNode.innerText).to.equal('');
      el._prioritizeAndFilterFeedback = ({ validationResults }) => validationResults;
      el.validate();
      await el.updateComplete;
      expect(el._feedbackNode.innerText).to.equal('Message for alwaysInvalid');
    });

    it('writes prioritized result to "._feedbackNode" based on Validator order', async () => {
      const el = await fixture(html`
        <${tag}
          .modelValue=${'cat'}
          .validators=${[new AlwaysInvalid(), new MinLength(4)]}
        >${lightDom}</${tag}>
      `);
      expect(el._feedbackNode.innerText).to.equal('Message for alwaysInvalid');
    });

    it('renders validation result to "._feedbackNode" when async messages are resolved', async () => {
      let unlockMessage;
      const messagePromise = new Promise(resolve => {
        unlockMessage = resolve;
      });

      AlwaysInvalid.getMessage = async () => {
        await messagePromise;
        return 'this ends up in ._feedbackNode';
      };

      const el = await fixture(html`
        <${tag}
          .modelValue=${'cat'}
          .validators=${[new AlwaysInvalid()]}
        >${lightDom}</${tag}>
      `);

      expect(el._feedbackNode.innerText).to.equal('');
      unlockMessage();
      await el.updateComplete;
      await aTimeout();
      expect(el._feedbackNode.innerText).to.equal('this ends up in "._feedbackNode"');
    });

    // N.B. this replaces the 'config.hideFeedback' option we had before...
    it('renders empty result when Validator.getMessage() returns "null"', async () => {
      let unlockMessage;
      const messagePromise = new Promise(resolve => {
        unlockMessage = resolve;
      });

      AlwaysInvalid.getMessage = async () => {
        await messagePromise;
        return 'this ends up in ._feedbackNode';
      };

      const el = await fixture(html`
        <${tag}
          .modelValue=${'cat'}
          .validators=${[new AlwaysInvalid()]}
        >${lightDom}</${tag}>
      `);

      expect(el._feedbackNode.innerText).to.equal('');
      unlockMessage();
      await el.updateComplete;
      await aTimeout();
      expect(el._feedbackNode.innerText).to.equal('this ends up in "._feedbackNode"');
    });

    it('supports custom element to render feedback', async () => {
      const customFeedbackTagString = defineCE(
        class extends LionValidationFeedback {
          render() {
            return html`
              ERROR on ${this.validator.name}
            `;
          }
        },
      );
      const customFeedbackTag = unsafeStatic(customFeedbackTagString);
      // TODO: refactor to support integration via externalDependencies.element
      const element = await fixture(html`
        <${tag}
          .validators=${[new ContainsLowercaseA(), new AlwaysInvalid()]}>
          <${customFeedbackTag} slot="feedback"><${customFeedbackTag}>
        </${tag}>
      `);

      element.modelValue = 'dog';
      await element.updateComplete;
      expect(element._feedbackNode.innerText).to.include('ERROR on containsLowercaseA');

      element.modelValue = 'cat';
      await element.updateComplete;
      expect(element._feedbackNode.innerText).to.include('ERROR on alwaysInvalid');
    });

    // TODO: move to compat layer or examples
    it('shows success message after fixing an error', async () => {
      const el = await fixture(html`
        <${tag}
        .validators=${[new MinLength(3), new DefaultSuccess()]}
        >${lightDom}</${tag}>
      `);

      el.modelValue = 'a';
      await el.updateComplete;
      expect(el._feedbackNode.innerText).to.equal('Message for minLength');

      el.modelValue = 'abcd';
      await el.updateComplete;
      expect(el._feedbackNode.innerText).to.equal('This is success message for alwaysInvalid');
    });

    describe('Field name', () => {
      let calledWithFieldName;
      MinLength.getMessage = ({ fieldName }) => {
        calledWithFieldName = fieldName;
        return `${fieldName} needs more characters`;
      };

      it('allows to use field name in messages', async () => {
        const el = await fixture(html`
          <${tag}
            .label=${'myField'}
            .validators=${[new MinLength(4)]}
            .modelValue=${'cat'}
          >${lightDom}</${tag}>
        `);
        expect(calledWithFieldName).to.equal(el.getFieldName());
      });

      describe('Field name construction', () => {
        it('allows to configure field name via ".getFieldName()"', async () => {
          const getName = sinon.spy(() => 'myFunction');
          const el = await fixture(html`
            <${tag}
              .getFieldName=${getName}
              .label="${'myLabel'}"
              .name="${'myName'}"
              .validators=${[new MinLength(4)]}
              .modelValue=${'cat'}
              >${lightDom}
            </${tag}>`);
          expect(getName.callCount).to.equal(1);
          expect(el._feedbackNode.innerText).to.equal('myFunction needs more characters');
        });

        it('allows to configure field name for every validator message', async () => {
          const el = await fixture(html`
            <${tag}
              .getFieldName=${() => 'myFunction'}
              .label="${'myField'}"
              .name="${'myName'}"
              .validators=${[new MinLength(4, { fieldName: 'overrideName' })]}
              .modelValue=${'cat'}
              >${lightDom}
            </${tag}>`);
          expect(el._feedbackNode.innerText).to.equal('overrideName needs more characters');
        });

        it('falls back to label or name (in this priority order)', async () => {
          // As seen in test above, configuring fieldName on validator level takes highest precedence
          const el = await fixture(html`
            <${tag}
              .label="${'myField'}"
              .name="${'myName'}"
              .validators=${[new MinLength(4)]}
              .modelValue=${'cat'}
              >${lightDom}
            </${tag}>`);
          expect(el._feedbackNode.innerText).to.equal('myField needs more characters');

          const el2 = await fixture(html`
          <${tag}
            .name="${'myName'}"
            .errorValidators=${[new MinLength(4)]}
            .modelValue=${'cat'}
            >${lightDom}
          </${tag}>`);
          expect(el2._feedbackNode.innerText).to.equal('myName needs more characters');
        });
      });
    });
  });

  describe.skip('Subclassers', () => {
    // Below a journey is described with which steps to take for:
    // - adding types "warning", "info" and "success"
    // - show validation based on Interaction States
    // - perform async validation only on blur

    describe('Adding new Validator types', () => {});

    describe('Adding new validation triggers', () => {});

    describe('Changing feedback visibility conditions', () => {
      // TODO: add this test on LionField layer
      it.skip('reconsiders feedback visibility when interaction states changed', async () => {
        // see https://codeburst.io/javascript-async-await-with-foreach-b6ba62bbf404
        async function asyncForEach(array, callback) {
          for (let i = 0; i < array.length; i += 1) {
            // we explicitly want to run it one after each other
            await callback(array[i], i, array); // eslint-disable-line no-await-in-loop
          }
        }

        const el = await fixture(html`
          <${tag}
            .validators=${[new AlwaysValid()]}
            .modelValue=${'myValue'}
          >${lightDom}</${tag}>
        `);

        const messageSpy = sinon.spy(el, '_renderFeedback');
        await asyncForEach(['dirty', 'touched', 'prefilled', 'submitted'], async (state, i) => {
          el[state] = false;
          await el.updateComplete;
          el[state] = true;
          await el.updateComplete;
          expect(messageSpy.callCount).to.equal(i + 1);
        });
      });
    });

    describe('Changing feedback messages globally', () => {});

    // TODO: see how we can combine this functionality with the way to
    describe.skip('Changing feedback messages per form (control)', () => {});
  });
});
