import{N as a,r as p,j as e,C as c,e as x,f as b,g as f,F as t}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const j={title:"Forms/NumberInput",component:a,tags:["autodocs"],args:{defaultValue:3,min:0,max:21,step:1,size:"md",disabled:!1,hideStepper:!1,"aria-label":"Estimate"},argTypes:{size:{control:"inline-radio",options:["sm","md","lg"]},unit:{control:"text"}},decorators:[s=>e.jsx("div",{className:"w-48",children:e.jsx(s,{})})],parameters:{docs:{description:{component:"A number with a stepper. ArrowUp/Down step (Shift for ×10), Home/End jump to the bounds;\ntyped text is parsed, clamped and rounded to `step` on Enter or blur."}}}},r={},n={args:{unit:"pts",defaultValue:5}},l={args:{defaultValue:1.5,step:.5,min:0,max:40,unit:"h","aria-label":"Time spent"}},d={render:s=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(a,{...s,size:"sm"}),e.jsx(a,{...s,size:"md"}),e.jsx(a,{...s,size:"lg"})]})},i={render:s=>e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsx(t,{label:"Empty",children:e.jsx(a,{...s,defaultValue:null,placeholder:"No estimate"})}),e.jsx(t,{label:"At maximum",description:"The up button is disabled.",children:e.jsx(a,{...s,defaultValue:21})}),e.jsx(t,{label:"Without stepper",children:e.jsx(a,{...s,hideStepper:!0,unit:"pts"})}),e.jsx(t,{label:"Disabled",children:e.jsx(a,{...s,disabled:!0})}),e.jsx(t,{label:"Seats",error:"Your plan includes up to 25 seats",children:e.jsx(a,{...s,defaultValue:30,max:void 0})})]})},o={render:function(){const[u,m]=p.useState(12);return e.jsxs(c,{className:"w-80",children:[e.jsx(x,{children:e.jsx(b,{children:"Business plan"})}),e.jsxs(f,{className:"flex flex-col gap-3",children:[e.jsx(t,{label:"Seats",description:"$12 per seat per month, billed yearly.",children:e.jsx(a,{value:u,onValueChange:m,min:1,max:500})}),e.jsxs("p",{className:"text-fg-muted text-sm",children:["Total:"," ",e.jsxs("span",{className:"font-medium text-fg",children:["$",(u??0)*12," / month"]})]})]})]})}},N=["Playground","WithUnit","Decimals","Sizes","States","InBillingSettings"];r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    unit: "pts",
    defaultValue: 5
  }
}`,...n.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: 1.5,
    step: 0.5,
    min: 0,
    max: 40,
    unit: "h",
    "aria-label": "Time spent"
  }
}`,...l.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex flex-col gap-3">
      <NumberInput {...args} size="sm" />
      <NumberInput {...args} size="md" />
      <NumberInput {...args} size="lg" />
    </div>
}`,...d.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex flex-col gap-4">
      <Field label="Empty">
        <NumberInput {...args} defaultValue={null} placeholder="No estimate" />
      </Field>
      <Field label="At maximum" description="The up button is disabled.">
        <NumberInput {...args} defaultValue={21} />
      </Field>
      <Field label="Without stepper">
        <NumberInput {...args} hideStepper unit="pts" />
      </Field>
      <Field label="Disabled">
        <NumberInput {...args} disabled />
      </Field>
      <Field label="Seats" error="Your plan includes up to 25 seats">
        <NumberInput {...args} defaultValue={30} max={undefined} />
      </Field>
    </div>
}`,...i.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [seats, setSeats] = useState<number | null>(12);
    return <Card className="w-80">
        <CardHeader>
          <CardTitle>Business plan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field label="Seats" description="$12 per seat per month, billed yearly.">
            <NumberInput value={seats} onValueChange={setSeats} min={1} max={500} />
          </Field>
          <p className="text-fg-muted text-sm">
            Total:{" "}
            <span className="font-medium text-fg">
              \${(seats ?? 0) * 12} / month
            </span>
          </p>
        </CardContent>
      </Card>;
  }
}`,...o.parameters?.docs?.source}}};export{l as Decimals,o as InBillingSettings,r as Playground,d as Sizes,i as States,n as WithUnit,N as __namedExportsOrder,j as default};
