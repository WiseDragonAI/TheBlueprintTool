export function browserParsePath(d) {
  return d.match(/-?\d+(?:\.\d+)?/g).map(Number).reduce(function browserParsePathPoint(points, value, index, values) {
    if (index % 2 === 0) points.push({ x: value, y: values[index + 1] });
    return points;
  }, []);
}
