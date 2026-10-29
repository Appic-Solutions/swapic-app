interface ShapeSize {
  width: string;
  height: string;
  positionTop?: string;
  positionBottom?: string;
  positionRight?: string;
  positionLeft?: string;
}

const SHAPE_SIZES: ShapeSize[] = [
  // left_top
  {
    width: '91px',
    height: '91px',
    positionTop: '25%',
    positionLeft: '5%',
  },
  // left_bottom
  {
    width: '120px',
    height: '120px',
    positionLeft: '8%',
    positionBottom: '20%',
  },
  // left_center
  {
    positionLeft: '30%',
    positionTop: '35%',
    width: '64px',
    height: '64px',
  },
  // right_top
  {
    positionRight: '29%',
    positionTop: '22%',
    width: '95px',
    height: '95px',
  },
  // right_center-first
  {
    positionRight: '0%',
    positionBottom: '25%',
    width: '220px',
    height: '220px',
  },
  // right_center-second
  {
    positionRight: '35%',
    positionBottom: '50%',
    width: '60px',
    height: '60px',
  },
  // right_bottom
  {
    positionRight: '30%',
    positionBottom: '15%',
    width: '95px',
    height: '95px',
  },
];

export default function ShapesPage() {
  return (
    <div className="absolute inset-0 z-[-1] hidden lg:block">
      {SHAPE_SIZES.map(
        ({ width, height, positionTop, positionBottom, positionRight, positionLeft }, idx) => (
          <div
            key={idx}
            className="absolute rounded-full bg-shapes-background opacity-50"
            style={{
              width,
              height,
              top: positionTop,
              bottom: positionBottom,
              right: positionRight,
              left: positionLeft,
            }}
          />
        ),
      )}
    </div>
  );
}
