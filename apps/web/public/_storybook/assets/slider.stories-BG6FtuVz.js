import{V as u,r as m,j as e,C as b,e as f,f as x,g as V,F as d}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const w={title:"Forms/Slider",component:u,tags:["autodocs"],args:{defaultValue:[40],min:0,max:100,step:1,showValue:!0,disabled:!1,thumbLabels:["Opacity"],formatValue:a=>`${a}%`},decorators:[a=>e.jsx("div",{className:"w-80",children:e.jsx(a,{})})],parameters:{docs:{description:{component:"Pick a number or a range by dragging or with arrow keys. Pass two values for a range;\n`showValue` prints the value next to the track."}}}},r={},s={args:{showValue:!1}},t={args:{defaultValue:[2,8],min:1,max:13,thumbLabels:["Minimum estimate","Maximum estimate"],formatValue:a=>`${a} pts`}},n={args:{defaultValue:[2],min:1,max:8,step:1,thumbLabels:["Cycle length"],formatValue:a=>`${a} ${a===1?"week":"weeks"}`}},o={args:{disabled:!0}},l={render:function(){const[i,p]=m.useState([80]),[g,h]=m.useState([3,21]);return e.jsxs(b,{className:"w-96",children:[e.jsx(f,{children:e.jsx(x,{children:"Cycle planning"})}),e.jsxs(V,{className:"flex flex-col gap-5",children:[e.jsx(d,{label:"Team capacity",description:"Share of the cycle reserved for planned work.",children:e.jsx(u,{value:i,onValueChange:p,step:5,showValue:!0,formatValue:c=>`${c}%`,thumbLabels:["Team capacity"]})}),e.jsx(d,{label:"Auto-archive window",children:e.jsx(u,{value:g,onValueChange:h,min:1,max:30,showValue:!0,formatValue:c=>`${c}d`,thumbLabels:["From day","To day"]})})]})]})}},S=["Playground","WithoutValue","Range","Steps","Disabled","InSettings"];r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    showValue: false
  }
}`,...s.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: [2, 8],
    min: 1,
    max: 13,
    thumbLabels: ["Minimum estimate", "Maximum estimate"],
    formatValue: (value: number) => \`\${value} pts\`
  }
}`,...t.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: [2],
    min: 1,
    max: 8,
    step: 1,
    thumbLabels: ["Cycle length"],
    formatValue: (value: number) => \`\${value} \${value === 1 ? "week" : "weeks"}\`
  }
}`,...n.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...o.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [capacity, setCapacity] = useState([80]);
    const [range, setRange] = useState([3, 21]);
    return <Card className="w-96">
        <CardHeader>
          <CardTitle>Cycle planning</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Field label="Team capacity" description="Share of the cycle reserved for planned work.">
            <Slider value={capacity} onValueChange={setCapacity} step={5} showValue formatValue={value => \`\${value}%\`} thumbLabels={["Team capacity"]} />
          </Field>
          <Field label="Auto-archive window">
            <Slider value={range} onValueChange={setRange} min={1} max={30} showValue formatValue={value => \`\${value}d\`} thumbLabels={["From day", "To day"]} />
          </Field>
        </CardContent>
      </Card>;
  }
}`,...l.parameters?.docs?.source}}};export{o as Disabled,l as InSettings,r as Playground,t as Range,n as Steps,s as WithoutValue,S as __namedExportsOrder,w as default};
