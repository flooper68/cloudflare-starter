import{D as s,j as e,o as g,k as d,s as r,r as f,C as h,e as b,f as j,g as k,F as n}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const T={title:"Forms/DatePicker",component:s,tags:["autodocs"],args:{placeholder:"Set due date",size:"md",disabled:!1,weekStartsOn:1,"aria-label":"Due date"},argTypes:{size:{control:"inline-radio",options:["sm","md","lg"]},weekStartsOn:{control:"inline-radio",options:[0,1]}},decorators:[a=>e.jsx("div",{className:"h-[440px] w-56",children:e.jsx(a,{})})],parameters:{docs:{description:{component:"A date field like Linear's due-date picker: presets (Today, Tomorrow, Next week, No\ndate) above a calendar; closes on pick. `DateRangePicker` picks a start and end on two\nmonths with quick ranges on the side."}}}},l={},o={args:{defaultOpen:!0,defaultValue:d(r(),2)}},c={args:{presets:[],defaultOpen:!0}},t={args:{disabledDates:{before:r()},defaultOpen:!0}},i={render:a=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(s,{...a,size:"sm",defaultValue:r()}),e.jsx(s,{...a,size:"md",defaultValue:r()}),e.jsx(s,{...a,size:"lg",defaultValue:r()})]})},u={render:a=>e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsx(n,{label:"Empty",children:e.jsx(s,{...a})}),e.jsx(n,{label:"Disabled",children:e.jsx(s,{...a,disabled:!0,defaultValue:d(r(),7)})}),e.jsx(n,{label:"Due date",error:"Due date must be before the cycle ends",children:e.jsx(s,{...a,defaultValue:d(r(),40)})})]})},p={render:()=>e.jsx(g,{"aria-label":"Cycle dates",weekStartsOn:1,defaultOpen:!0,defaultValue:{from:r(),to:d(r(),13)}}),decorators:[a=>e.jsx("div",{className:"h-[400px] w-[680px]",children:e.jsx(a,{})})]},m={render:function(){const[x,y]=f.useState(d(r(),30)),[O,D]=f.useState(null);return e.jsxs(h,{className:"w-80",children:[e.jsx(b,{children:e.jsx(j,{children:"Mobile app v3"})}),e.jsxs(k,{className:"flex flex-col gap-3",children:[e.jsx(n,{label:"Target date",children:e.jsx(s,{value:x,onValueChange:y,weekStartsOn:1})}),e.jsx(n,{label:"Beta period",optional:!0,children:e.jsx(g,{value:O,onValueChange:D,weekStartsOn:1})})]})]})},decorators:[a=>e.jsx("div",{className:"h-[440px] w-[680px]",children:e.jsx(a,{})})]},v=["Playground","Open","WithoutPresets","FutureOnly","Sizes","States","DateRangeOpen","InAProjectForm"];l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:"{}",...l.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    defaultOpen: true,
    defaultValue: addDays(startOfToday(), 2)
  }
}`,...o.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    presets: [],
    defaultOpen: true
  }
}`,...c.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    disabledDates: {
      before: startOfToday()
    },
    defaultOpen: true
  }
}`,...t.parameters?.docs?.source},description:{story:"Only future dates can be picked.",...t.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex flex-col gap-3">
      <DatePicker {...args} size="sm" defaultValue={startOfToday()} />
      <DatePicker {...args} size="md" defaultValue={startOfToday()} />
      <DatePicker {...args} size="lg" defaultValue={startOfToday()} />
    </div>
}`,...i.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex flex-col gap-4">
      <Field label="Empty">
        <DatePicker {...args} />
      </Field>
      <Field label="Disabled">
        <DatePicker {...args} disabled defaultValue={addDays(startOfToday(), 7)} />
      </Field>
      <Field label="Due date" error="Due date must be before the cycle ends">
        <DatePicker {...args} defaultValue={addDays(startOfToday(), 40)} />
      </Field>
    </div>
}`,...u.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: () => <DateRangePicker aria-label="Cycle dates" weekStartsOn={1} defaultOpen defaultValue={{
    from: startOfToday(),
    to: addDays(startOfToday(), 13)
  }} />,
  decorators: [Story => <div className="h-[400px] w-[680px]">
        <Story />
      </div>]
}`,...p.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [target, setTarget] = useState<Date | null>(addDays(startOfToday(), 30));
    const [cycle, setCycle] = useState<DateRange | null>(null);
    return <Card className="w-80">
        <CardHeader>
          <CardTitle>Mobile app v3</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field label="Target date">
            <DatePicker value={target} onValueChange={setTarget} weekStartsOn={1} />
          </Field>
          <Field label="Beta period" optional>
            <DateRangePicker value={cycle} onValueChange={setCycle} weekStartsOn={1} />
          </Field>
        </CardContent>
      </Card>;
  },
  decorators: [Story => <div className="h-[440px] w-[680px]">
        <Story />
      </div>]
}`,...m.parameters?.docs?.source}}};export{p as DateRangeOpen,t as FutureOnly,m as InAProjectForm,o as Open,l as Playground,i as Sizes,u as States,c as WithoutPresets,v as __namedExportsOrder,T as default};
