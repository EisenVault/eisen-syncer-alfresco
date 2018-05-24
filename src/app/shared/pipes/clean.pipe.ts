import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'cleanString'
})
export class CleanStringPipe implements PipeTransform {
    transform(value: any, ...args: any[]) {
        return value.replace(/\\/g, "");
    }
}