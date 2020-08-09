/* eslint-disable no-mixed-operators */
const round = (number, digits) => {
	const x = number * 10 ** digits;
	const r = Math.round(x);
	const br = Math.abs(x) % 1 === 0.5 ? (r % 2 === 0 ? r : r - 1) : r;
	return br / 10 ** digits;
};

export default round;
