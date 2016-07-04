/* 
	From mithril.animate.js - https://github.com/jsguy/mithril.animate 

	Allows you to prefix a CSS proeprty, if it needs it, 
	optionally making it a "dashed" version, eg:

	prefix({prop: "grab"}) -> "grab" doesn't need to be prefixed, as it is not a valid property
	prefix({prop: "grab", force: true}) -> "WebkitGrab" forced prefix
	prefix({prop: "grab", force: true, dashed: true}) -> "-webkit-grab" forced prefix in "dashed" mode

	Also handles @keyframes declarations
*/
;(function(win){
	//	Known prefiex
	var prefixes = ['Moz', 'Webkit', 'Khtml', 'O', 'ms'],

	//	Capitalise
	cap = function(str){
		return str.charAt(0).toUpperCase() + str.substr(1);
	},

	//	For checking what vendor prefixes are native
	div = document.createElement('div'),

	//	vendor prefix, ie: transitionDuration becomes MozTransitionDuration
	vp = function (args) {
		var pf,
			thePrefix,
			ele,
			sProp,
			i,
			createPrefix = function(prop, prefix){
				return args.dashed? 
					"-" + prefix.toLowerCase() + "-" + prop.toLowerCase():
					prefix + cap(args.prop);
			};

		//	Find what prefix this browser uses, then apply it ragardless
		if(args.force) {
			ele = document.getElementsByTagName('script')[0];

			for(sProp in ele.style) {
				for(i = 0; i < prefixes.length; i += 1) {
					if((""+sProp).indexOf(prefixes[i]) > 0)
					{
						// test is faster than match, so it's better to perform
						// that on the lot and match only when necessary
						thePrefix = prefixes[i];
						break;
					}
				}
				if(thePrefix) {
					break;
				}
			}

			// Webkit doesn't enumerate CSS properties of the style object.
			if('WebkitOpacity' in ele.style) {
				thePrefix = 'Webkit';
			} else if('KhtmlOpacity' in ele.style) {
				thePrefix = 'Khtml';
			}

			return createPrefix(args.prop, thePrefix);
		}

		//	Handle unprefixed
		if (args.prop in div.style) {
			return args.prop;
		}

		//	Handle keyframes
		if(args.prop == "@keyframes") {
			for (i = 0; i < prefixes.length; i += 1) {
				//	Testing using transition
				pf = prefixes[i] + "Transition";
				if (pf in div.style) {
					return "@-" + prefixes[i].toLowerCase() + "-keyframes";
				}
			}
			return args.prop;
		}

		for (i = 0; i < prefixes.length; i += 1) {
			pf = createPrefix(args.prop, prefixes[i]);
			if (pf in div.style) {
				return pf;
			}
		}
		//	Can't find it - return original property.
		return args.prop;
	};

	win.prefix = vp;

}(window));