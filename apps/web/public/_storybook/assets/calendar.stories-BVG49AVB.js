import{i as p,s as e,r as g,k as n,j as o}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const f={title:"Forms/Calendar",component:p,tags:["autodocs"],args:{showOutsideDays:!0,numberOfMonths:1,weekStartsOn:1},argTypes:{weekStartsOn:{control:"inline-radio",options:[0,1]},numberOfMonths:{control:{type:"number",min:1,max:3}}},decorators:[d=>o.jsx("div",{className:"rounded-lg border border-line bg-overlay shadow-overlay",children:o.jsx(d,{})})],parameters:{docs:{description:{component:`A compact month grid (react-day-picker 10): accent fill on the selection, a ring on
today, arrow keys to move, Page Up/Down for months. Takes every DayPicker prop. In a field,
use DatePicker or DateRangePicker.`}}}},c={},i={render:function(r){const[a,s]=g.useState(n(e(),3));return o.jsx(p,{weekStartsOn:r.weekStartsOn,mode:"single",selected:a,onSelect:s})}},l={render:function(r){const[a,s]=g.useState({from:e(),to:n(e(),9)});return o.jsx(p,{weekStartsOn:r.weekStartsOn,mode:"range",numberOfMonths:2,selected:a,onSelect:s})}},m={render:function(r){const[a,s]=g.useState([n(e(),1),n(e(),4),n(e(),8)]);return o.jsx(p,{weekStartsOn:r.weekStartsOn,mode:"multiple",selected:a,onSelect:s})}},t={args:{disabled:[{before:e()},{dayOfWeek:[0,6]}]}},u={args:{footer:"Cycle 42 ends on Friday."}},O=["Playground","Single","Range","Multiple","DisabledDays","WithFooter"];c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:"{}",...c.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: function Render(args) {
    const [selected, setSelected] = useState<Date | undefined>(addDays(startOfToday(), 3));
    return <Calendar weekStartsOn={args.weekStartsOn} mode="single" selected={selected} onSelect={setSelected} />;
  }
}`,...i.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: function Render(args) {
    const [range, setRange] = useState<DateRange | undefined>({
      from: startOfToday(),
      to: addDays(startOfToday(), 9)
    });
    return <Calendar weekStartsOn={args.weekStartsOn} mode="range" numberOfMonths={2} selected={range} onSelect={setRange} />;
  }
}`,...l.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  render: function Render(args) {
    const [days, setDays] = useState<Date[] | undefined>([addDays(startOfToday(), 1), addDays(startOfToday(), 4), addDays(startOfToday(), 8)]);
    return <Calendar weekStartsOn={args.weekStartsOn} mode="multiple" selected={days} onSelect={setDays} />;
  }
}`,...m.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: [{
      before: startOfToday()
    }, {
      dayOfWeek: [0, 6]
    }]
  }
}`,...t.parameters?.docs?.source},description:{story:"Past days and weekends are disabled.",...t.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    footer: "Cycle 42 ends on Friday."
  }
}`,...u.parameters?.docs?.source}}};export{t as DisabledDays,m as Multiple,c as Playground,l as Range,i as Single,u as WithFooter,O as __namedExportsOrder,f as default};
