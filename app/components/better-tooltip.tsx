// @ts-nocheck
import classNames from "classnames";
import { motion } from "framer-motion";
import _ from "lodash";
import type { CSSProperties, ReactElement, ReactNode, SVGProps } from "react";
import React, { PureComponent } from "react";
import type { NameType, Payload, Props as DefaultProps, ValueType } from "recharts/src/component/DefaultTooltipContent";
import { DefaultTooltipContent } from "recharts/es6/component/DefaultTooltipContent";
import { isNumber } from "recharts/es6/util/DataUtils";
import { Global } from "recharts/es6/util/Global";
import type { AnimationTiming } from "recharts/src/util/types";

const CLS_PREFIX = "recharts-tooltip-wrapper";

const EPS = 1;
export type ContentType<TValue extends ValueType, TName extends NameType> =
  | ReactElement
  | ((props: TooltipProps<TValue, TName>) => ReactNode);

type UniqueFunc<TValue extends ValueType, TName extends NameType> = (entry: Payload<TValue, TName>) => unknown;
type UniqueOption<TValue extends ValueType, TName extends NameType> = boolean | UniqueFunc<TValue, TName>;
function defaultUniqBy<TValue extends ValueType, TName extends NameType>(entry: Payload<TValue, TName>) {
  return entry.dataKey;
}
function getUniqPayload<TValue extends ValueType, TName extends NameType>(
  option: UniqueOption<TValue, TName>,
  payload: Array<Payload<TValue, TName>>,
) {
  if (option === true) {
    return _.uniqBy(payload, defaultUniqBy);
  }

  if (_.isFunction(option)) {
    return _.uniqBy(payload, option);
  }

  return payload;
}

function renderContent<TValue extends ValueType, TName extends NameType>(
  content: ContentType<TValue, TName>,
  props: TooltipProps<TValue, TName>,
) {
  if (React.isValidElement(content)) {
    return React.cloneElement(content, props);
  }
  if (_.isFunction(content)) {
    return React.createElement(content as any, props);
  }

  return <DefaultTooltipContent {...props} />;
}

export type TooltipProps<TValue extends ValueType, TName extends NameType> = DefaultProps<TValue, TName> & {
  allowEscapeViewBox?: {
    x?: boolean;
    y?: boolean;
  };
  content?: ContentType<TValue, TName>;
  viewBox?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  active?: boolean;
  offset?: number;
  wrapperStyle?: CSSProperties;
  cursor?: boolean | ReactElement | SVGProps<SVGElement>;
  coordinate?: {
    x?: number;
    y?: number;
  };
  position?: {
    x?: number;
    y?: number;
  };
  trigger?: "hover" | "click";
  shared?: boolean;
  payloadUniqBy?: UniqueOption<TValue, TName>;
  isAnimationActive?: boolean;
  animationDuration?: number;
  animationEasing?: AnimationTiming;
  filterNull?: boolean;
  useTranslate3d?: boolean;
};

export class BetterTooltip<TValue extends ValueType, TName extends NameType> extends PureComponent<
  TooltipProps<TValue, TName>
> {
  static displayName = "Tooltip";

  static defaultProps = {
    active: false,
    allowEscapeViewBox: { x: false, y: false },
    offset: 10,
    viewBox: { x1: 0, x2: 0, y1: 0, y2: 0 },
    coordinate: { x: 0, y: 0 },
    cursorStyle: {},
    separator: " : ",
    wrapperStyle: {},
    contentStyle: {},
    itemStyle: {},
    labelStyle: {},
    cursor: true,
    trigger: "hover",
    isAnimationActive: !Global.isSsr,
    animationEasing: "ease",
    animationDuration: 400,
    filterNull: true,
    useTranslate3d: false,
  };

  state = {
    boxWidth: -1,
    boxHeight: -1,
    dismissed: false,
    dismissedAtCoordinate: { x: 0, y: 0 },
  };

  private wrapperNode: HTMLDivElement;

  componentDidMount() {
    this.updateBBox();
  }

  componentDidUpdate() {
    this.updateBBox();
  }

  updateBBox() {
    const { boxWidth, boxHeight, dismissed } = this.state;
    if (dismissed) {
      this.wrapperNode.blur();
      if (
        this.props.coordinate.x !== this.state.dismissedAtCoordinate.x ||
        this.props.coordinate.y !== this.state.dismissedAtCoordinate.y
      ) {
        this.setState({ dismissed: false });
      }
    } else {
      this.wrapperNode.focus({ preventScroll: true });
    }

    if (this.wrapperNode && this.wrapperNode.getBoundingClientRect) {
      const box = this.wrapperNode.getBoundingClientRect();

      if (Math.abs(box.width - boxWidth) > EPS || Math.abs(box.height - boxHeight) > EPS) {
        this.setState({
          boxWidth: box.width,
          boxHeight: box.height,
        });
      }
    } else if (boxWidth !== -1 || boxHeight !== -1) {
      this.setState({
        boxWidth: -1,
        boxHeight: -1,
      });
    }
  }

  getTranslate = ({
    key,
    tooltipDimension,
    viewBoxDimension,
  }: {
    key: "x" | "y";
    tooltipDimension: number;
    viewBoxDimension: number;
  }) => {
    const { allowEscapeViewBox, coordinate, offset, position, viewBox } = this.props;

    if (position && isNumber(position[key])) {
      return position[key];
    }

    const restricted = coordinate[key] - tooltipDimension - offset;
    const unrestricted = coordinate[key] + offset;
    if (allowEscapeViewBox[key]) {
      return unrestricted;
    }

    const tooltipBoundary = coordinate[key] + tooltipDimension + offset;
    const viewBoxBoundary = viewBox[key] + viewBoxDimension;
    if (tooltipBoundary > viewBoxBoundary) {
      return Math.max(restricted, viewBox[key]);
    }
    return Math.max(unrestricted, viewBox[key]);
  };

  render() {
    const { payload, isAnimationActive, animationDuration, animationEasing, filterNull, payloadUniqBy } = this.props;
    const finalPayload = getUniqPayload(
      payloadUniqBy,
      filterNull && payload && payload.length ? payload.filter((entry) => !_.isNil(entry.value)) : payload,
    );
    const hasPayload = finalPayload && finalPayload.length;
    const { content, viewBox, coordinate, position, active, wrapperStyle } = this.props;
    let outerStyle: CSSProperties = {
      pointerEvents: "none",
      visibility: !this.state.dismissed && active && hasPayload ? "visible" : "hidden",
      position: "absolute",
      top: 0,
      left: 0,
      ...wrapperStyle,
    };
    let translateX, translateY;

    if (position && isNumber(position.x) && isNumber(position.y)) {
      translateX = position.x;
      translateY = position.y;
    } else {
      const { boxWidth, boxHeight } = this.state;

      if (boxWidth > 0 && boxHeight > 0 && coordinate) {
        translateX = this.getTranslate({
          key: "x",
          tooltipDimension: boxWidth,
          viewBoxDimension: viewBox.width,
        });

        translateY = this.getTranslate({
          key: "y",
          tooltipDimension: boxHeight,
          viewBoxDimension: viewBox.height,
        });
      } else {
        outerStyle.visibility = "hidden";
      }
    }

    outerStyle = {
      ...outerStyle,
    };

    if (isAnimationActive && active) {
      outerStyle = {
        ...outerStyle,
      };
    }

    const cls = classNames(CLS_PREFIX, {
      [`${CLS_PREFIX}-right`]:
        isNumber(translateX) && coordinate && isNumber(coordinate.x) && translateX >= coordinate.x,
      [`${CLS_PREFIX}-left`]: isNumber(translateX) && coordinate && isNumber(coordinate.x) && translateX < coordinate.x,
      [`${CLS_PREFIX}-bottom`]:
        isNumber(translateY) && coordinate && isNumber(coordinate.y) && translateY >= coordinate.y,
      [`${CLS_PREFIX}-top`]: isNumber(translateY) && coordinate && isNumber(coordinate.y) && translateY < coordinate.y,
    });

    return (
      // ESLint is disabled to allow listening to the `Escape` key. Refer to
      // https://github.com/recharts/recharts/pull/2925
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, react/jsx-no-undef
      <motion.div
        animate={{ x: translateX, y: translateY }}
        transition={{ type: "spring", damping: 50, stiffness: 200, mass: 0.1 }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            this.setState({
              dismissed: true,
              dismissedAtCoordinate: {
                ...this.state.dismissedAtCoordinate,
                x: this.props.coordinate.x,
                y: this.props.coordinate.y,
              },
            });
          }
        }}
        className={cls}
        style={outerStyle}
        ref={(node) => {
          this.wrapperNode = node;
        }}
      >
        {renderContent(content, { ...this.props, payload: finalPayload })}
      </motion.div>
    );
  }
}
