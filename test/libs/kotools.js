/*global window, document*/
/*jslint white: true, onevar: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, newcap: true, immed: true */
/*
	kotools - tools for working with KnockoutJS

	An expansion of KnockoutJS

	Copyright (c) 2012 - jsguy.com

	Licence
	-------

	(The MIT License)

	Copyright (c) 2012 jsguy &lt;mikkel@jsguy.com&gt;

	Permission is hereby granted, free of charge, to any person obtaining
	a copy of this software and associated documentation files (the
	'Software'), to deal in the Software without restriction, including
	without limitation the rights to use, copy, modify, merge, publish,
	distribute, sublicense, and/or sell copies of the Software, and to
	permit persons to whom the Software is furnished to do so, subject to
	the following conditions:

	The above copyright notice and this permission notice shall be
	included in all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
	EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
	IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
	CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
	TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
	SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function (ko) {
	//  Pass in a viewmodel to debug it
	//  args: { notify: function(name, value, property){...}, quite: boolean }
	//  notify is a callback function for each notification, passed: name, value, property
	//  Concept borrowed from sole.js
	ko.debugModel = function (model, args) {
		args = args || {};
		var quiet = (args.quiet !== undefined) ? args.quiet : false;
		//  Subscribe to all viewodel properties
		for (var i in model) {
			if (model.hasOwnProperty(i)) {
				if (model[i].subscribe) {
					(function (name, property) {
						property.subscribe(function () {
							var value = property();
							if (!quiet && window.console && console.dir && console.groupCollapsed) {
								console.groupCollapsed(name);
								console.dir(property);
								console.groupEnd();
								console.log(value);
							}
							if (typeof args.notify === 'function') {
								args.notify(name, value, property);
							}
						});
					}(i, model[i]));
				}
			}
		};
		return model;
	};


	/*  valueInit - initialise a value binding using the value of the given field

		. Re-use the value in the field
		. Binding check boxes and radios to 'checked' attribute no longer necessary, just use valueInit, and this will do the rest

		Note: when using selectboxes, don't forget to add the optionsInit valueArray too - KO needs this to work properly with select boxes
	*/
	ko.bindingHandlers.valueInit = {
		init: function (element, valueAccessor, allBindingsAccessor, context) {
			var et = element.type.toUpperCase(),
				isSelect = (element.nodeName.toUpperCase() === 'SELECT'),
				isRadioOrCheckbox = et === 'RADIO' || et === 'CHECKBOX',
				va = valueAccessor(), op, val = element.value, setVal = true;

			if (isRadioOrCheckbox) {
				if (!element.checked) {
					setVal = false;
				}
			} else if(isSelect) {
				//  Grab value or the text if no value set ("" is for IE's sillyness)
				op = (element.selectedIndex)? element.options[element.selectedIndex]: "";
				val = (op.value !== undefined && op.value !== "") ? op.value: op.text;
			}

			if(setVal) {
				//  Check if it's an array, and set value appropriately
				if (va.push) {
					va.push(val);
				} else {
					va(val);
				}
			}

			if (isRadioOrCheckbox) {
				//  Pass through to KO checked
				ko.bindingHandlers.checked.init(element, valueAccessor, allBindingsAccessor, context);
			} else {
				//  Pass through to KO value
				ko.bindingHandlers.value.init(element, valueAccessor, allBindingsAccessor, context);
			}
		},
		update: function (element, valueAccessor) {
			var et = element.type.toUpperCase(),
				isRadioOrCheckbox = et === 'RADIO' || et === 'CHECKBOX';

			//  Pass through to KO
			if (isRadioOrCheckbox) {
				//	From: http://stackoverflow.com/questions/19085819/jquery-mobile-and-knockout-checkbox-not-updating-with-viewmodel
		        //KO v3 does not use 'update' for 'checked' binding
		        if (ko.bindingHandlers.checked.update) { 
		            ko.bindingHandlers.checked.update.apply(this, arguments); //for KO < v3, delegate the call
		        } else {
		            ko.utils.unwrapObservable(valueAccessor()); //for KO v3, force a subscription to get further updates
				}


			} else {
				ko.bindingHandlers.value.update(element, valueAccessor);
			}
		}
	};

	/*  Passthrough for radio and checkboxes */
	ko.bindingHandlers.checkedInit = ko.bindingHandlers.valueInit;

	/*  optionsInit - initialise selectbox options binding using the options of the selectbox

		. Re-use the value and options in the selectbox
		. Binding selects automatically uses values or option labels, or a combination of both
		. Binding selects is a lot simpler, we automatically set the optionText and optionValue, so you don't have to

		Note: when using selectboxes, don't forget to add the optionsInit valueArray too - KO needs this to work properly with select boxes
		Note: this won't work with optionsCaption - provide an empty option yourself instead.

	*/
	ko.bindingHandlers.optionsInit = {
		init: function (element, valueAccessor, allBindingsAccessor) {
			var isSelect = (element.nodeName.toUpperCase() === 'SELECT'),
				options = [],
				allBindings = allBindingsAccessor(),
				va, op, opItem, i, value, name,
				attr, atName, j;

			if (isSelect) {
				for (i = 0; i < element.options.length; i += 1) {
					//  Grab value or the text if no value set ("" is for IE's sillyness)
					op = element.options[i];
					value = (op.value !== undefined && op.value !== "") ? op.value: op.text;

					name = ('' + op.text) || op.value;
					opItem = { value: value, name: name };

					//	Find any "data-ko-?", and add to options object, so that we can easily have complex data models
					for (j = 0; j < op.attributes.length; j += 1) {
						attr = op.attributes.item(j);
						atName = attr.nodeName;
						if(atName.indexOf('data-ko-') == 0) {
							atName = atName.substr(8);
							opItem[atName] = attr.nodeValue;
						}
					}

					//  Preserve both value and name
					options.push(opItem);
				}

				va = valueAccessor();

				//  Set the values
				if (typeof va === 'function') {
					va(options);
				} else {
					//  Warn that they probably used a function for the options
					window.console && console.warn('optionsInit needs an observableArray for the valueAccessor. Most likely you declared your "optionsInit: theOptions()", removed the brackets, so you get optionsInit: theOptions');
				}

				//  Override the allBindingsAccessor, so we can set the optionsText and optionsValue
				var newABA = function () {
					var aba = allBindingsAccessor();
					aba['optionsText'] = 'name';
					aba['optionsValue'] = 'value';
					return aba;
				};

				//  Pass through to KO
				ko.bindingHandlers.options.update(element, valueAccessor, newABA);
			} else {
				//  Warn that it's for selects only
				window.console && console.warn('optionsInit works only with selectboxes');
			}
		}
	};
}(window.ko || {}));